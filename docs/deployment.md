# Deployment — the VM, and how to ship to it

Written for someone who has never deployed a server. Every command is
copy-pasteable. Values only you have are in `<angle brackets>`.

**Two things live here.** Part A is the one-time server build. Part B is
what you do every time you change the code — one command, `./deploy.sh`.

---

## What you end up with

```
                    https://<your-domain>
                              │
                    ┌─────────┴─────────┐
                    │   nginx  :443     │   TLS, static files, reverse proxy
                    └─────────┬─────────┘
             /  /methodology  │  /api/*
          ┌─────────┐         └──────────┐
          │  dist/  │                    ▼
          │ (React) │        127.0.0.1:8000  uvicorn → FastAPI
          └─────────┘                    │
                                         ▼
                              MongoDB Atlas  (optional)
```

**One origin.** The browser never makes a cross-origin request, so CORS is
not involved and the SSE scan stream needs no preflight. That is the whole
reason nginx serves the frontend rather than it living somewhere else.

**One VM for both.** The frontend is not a running program — `npm run
build` turns it into plain files that need *a web server to hand them
out*, not a server of their own. nginx does that in the same breath as
proxying `/api/` to Python.

### Why not Cloud Run / serverless

Worth knowing so nobody talks you into it later. The scanner makes
**outbound** requests to domains you do not own, and two things depend on
that traffic leaving from one fixed address:

- **The Atlas allowlist** is `<VM_IP>/32`. Serverless egress IPs rotate,
  so you would be back to `0.0.0.0/0` or paying for a VPC connector plus
  Cloud NAT to get a static IP back.
- **The `USER_AGENT` posture.** The legal argument in
  [scan-checks.md](scan-checks.md) is *we are identifiable*: one stable IP
  carrying a truthful contact URL. Rotating Google IPs weaken it.

A plain VM gives both for free.

---

## The on-disk layout

```
/srv/boundry/
├── releases/
│   ├── 2026-09-23-114233/     backend/ + frontend/dist/
│   ├── 2026-09-23-153001/
│   └── …                      the last 5 are kept
├── shared/
│   ├── .env                   credentials — survives every deploy
│   └── venv/                  Python dependencies — survives every deploy
└── current -> releases/2026-09-23-153001
```

nginx and systemd both point at **`current`**, never at a dated
directory. Shipping a release is therefore one symlink move, and rolling
back is the same move in reverse — two seconds, no rebuild. That is the
capability people usually reach for Docker to get, and this is the cheap
version of it.

---

## Ports, origins, and the two `.env` files

The question everyone asks first: *the frontend runs on 5174 and the
backend on 8000, so how do they talk in production?*

**They don't — because in production there is only one port.**

| | Development | Production |
|---|---|---|
| Frontend | vite dev server on `:5174` | no server at all — built files on disk |
| Backend | uvicorn on `:8000`, reachable | uvicorn on `127.0.0.1:8000`, **loopback only** |
| Exposed to the internet | both | **`:80` only, or `:443` once TLS is on** |
| Origins the browser sees | one (vite proxies `/api`) | one |
| CORS | never fires | never fires |

`--host 127.0.0.1` in the systemd unit is the important half. It binds
uvicorn to the loopback interface, so port 8000 is unreachable from
outside the machine no matter what the firewall says. nginx reaches it
because nginx is *on* the machine.

### The frontend never needs to know the backend's address

`src/utils/config.js` already does the right thing:

```js
const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
export const config = { baseUrl, api: `${baseUrl}/api` };
```

Blank, so every request goes to `/api/...` — a **relative** URL. The
browser sends it to whatever host the page came from:

```
dev     http://localhost:5174/api/scan   → vite proxy → :8000
demo    http://<VM_IP>/api/scan          → nginx      → :8000
live    https://your-domain/api/scan     → nginx      → :8000
```

Same code, same origin, both times. **Leave `VITE_API_BASE_URL` blank.**
Vite inlines `import.meta.env` at build time, so a value in
`frontend/.env` gets baked into the bundle permanently — set it only if
you one day move the API to a genuinely different host, which would also
mean turning CORS back on and losing the preflight-free SSE stream.

### Why two `.env` files

| | `backend/.env` (your Mac) | `/srv/boundry/shared/.env` (VM) |
|---|---|---|
| `CORS_ORIGINS` | `http://localhost:5173` | `https://your-domain` |
| `TRUST_PROXY` | unset — no proxy locally | `1` |
| `USER_AGENT` | whatever | the real company URL |
| `MONGODB_URI` | dev cluster, or blank | prod cluster, allowlisted to `<VM_IP>` |
| `RATE_LIMIT_PER_IP` | raised, so testing doesn't trip it | unset — ships at 10 |

They are different files with different values on purpose. The local one
is gitignored **and** excluded from the deploy tarball, so it cannot
reach the server by accident; the server's copy is written once by hand
and survives every deploy because it lives in `shared/`, outside any
release directory.

### How the server's file is actually loaded

`config.py` calls `load_dotenv(backend/.env)`, and on the VM that file
does not exist — `load_dotenv` returns quietly when the path is missing.
The values arrive a different way:

```
systemd reads EnvironmentFile=/srv/boundry/shared/.env   (as root)
        ↓ injects them as real environment variables
        ↓ drops to www-data, starts uvicorn
os.getenv("MONGODB_URI")                                   works
```

`load_dotenv` defaults to `override=False`, so even if a stray
`backend/.env` did appear in a release, the systemd values would still
win.

> **One syntax gotcha.** systemd's `EnvironmentFile` parser is not
> dotenv. Full-line `#` comments are fine, but a `#` **inside a value**
> starts a comment, and a stray `$` gets expanded. If your Mongo password
> contains either, wrap the value in double quotes:
>
> ```ini
> MONGODB_URI="mongodb+srv://user:p#ssw0rd@cluster.mongodb.net/?retryWrites=true"
> ```
>
> Quoting every value is harmless, so quote when in doubt. After editing:
> `sudo systemctl restart boundry && ./deploy.sh status`

### Changing a value later

`.env` is read at process start, so editing it does nothing until a
restart:

```bash
ssh boundry
sudo nano /srv/boundry/shared/.env
sudo systemctl restart boundry
exit
./deploy.sh status
```

No redeploy needed — the file is not part of a release.

---

# Part A — build the server (once)

> **Status: done.** The VM `boundry` at `34.180.15.100` is built and
> serving. This part is here for the next environment, or if this one has
> to be rebuilt.

## A0. Decisions

| Decision | Choice | Why |
|---|---|---|
| Region | `asia-south1` (Mumbai) | The clients are Indian, and the scan's 30-second budget is mostly round trips. |
| Machine | `e2-medium` — 2 vCPU, 4 GB | `e2-small` (2 GB) runs it fine but cannot build the frontend. 4 GB keeps that option open. ~$31/month, about 9 months of the $300 trial credit. |
| OS | Ubuntu 24.04 LTS, **x86/64** | Ships Python 3.12, which this codebase runs on — checked, there is no 3.13+ syntax in `backend/`. Supported to 2029. |
| Disk | 20 GB balanced | 10 GB works; 20 GB costs pennies and saves a resize. |
| Backups | Snapshot schedule, daily | About $1/month. The difference between "restore yesterday" and "rebuild from scratch". |

## A1. Create the VM

**Compute Engine → VM instances → Create instance.**

| Section | Set |
|---|---|
| Machine configuration | Name `boundry` · Region `asia-south1` · Zone `asia-south1-a` · Series **E2** · `e2-medium` |
| OS and storage | **Change** → Ubuntu → **Ubuntu 24.04 LTS** · `x86/64, amd64` · **not** "Minimal" · Balanced · **20 GB** |
| Data protection | Snapshot schedules (the default) |
| Networking | ☑ **Allow HTTP traffic** ☑ **Allow HTTPS traffic** |

> Two traps in the image list. Half the rows are **Arm64**, which will not
> boot on an E2 machine — the grey second line must read `x86/64, amd64`.
> And the *Minimal* images drop standard tooling; scroll up past them.
>
> The **name is permanent.** A VM cannot be renamed, only replaced.

Then **Create**.

## A2. Reserve the IP — before anything points at it

**VPC network → IP addresses → External IP addresses** → the `boundry`
row → **Type: Ephemeral → Static** → name `scorecard-ip` → **Reserve**.

An ephemeral IP changes when the VM restarts, taking your DNS record,
your SSH config and your MongoDB allowlist with it.

Write it down. Everything below calls it `<VM_IP>`.

## A3. SSH from your own terminal

The console's browser SSH works, but you want a real terminal for `scp`.

**On your Mac**, hand Google the public half of your key. GCP turns the
comment at the end of the key into the Linux username, so give it a clean
one:

```bash
awk '{print $1, $2, "kalpesh"}' ~/.ssh/id_ed25519.pub | pbcopy
```

Console → **`boundry`** → **Edit** → **SSH Keys** → **+ Add item** →
paste → **Save**.

Then make it one word:

```bash
cat >> ~/.ssh/config <<'EOF'

Host boundry
  HostName <VM_IP>
  User kalpesh
  IdentityFile ~/.ssh/id_ed25519
EOF
chmod 600 ~/.ssh/config
```

```bash
ssh boundry          # should land on kalpesh@boundry:~$
```

The alias `boundry` is *your local nickname*. Plain SSH connects by IP and
has no idea what Google calls the machine — the two only have to match if
you use `gcloud compute ssh`, which none of this does.

## A4. Base packages

**On the VM:**

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-venv python3-pip nginx git unattended-upgrades
```

## A5. The directory layout

**On the VM:**

```bash
sudo mkdir -p /srv/boundry/releases /srv/boundry/shared
sudo chown -R $USER:www-data /srv/boundry
python3 -m venv /srv/boundry/shared/venv
/srv/boundry/shared/venv/bin/pip install --upgrade pip
```

## A6. The environment file

**This holds credentials.** Root-owned and `600`: systemd reads it as root
before dropping to `www-data`, so nothing else needs access.

```bash
sudo install -m 600 /dev/null /srv/boundry/shared/.env
sudo nano /srv/boundry/shared/.env
```

```ini
GROQ_API_KEY=<your groq key, or leave blank>
CERTSPOTTER_API_KEY=<your certspotter key>
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=scorecard

# Same-origin in production, but set it truthfully anyway.
CORS_ORIGINS=https://<your-domain>

# nginx sits in front, so X-Forwarded-For is now trustworthy and the
# per-IP rate limiter must read it. Without this every visitor shares
# one bucket — nginx's — and the tenth scan of the hour is refused for
# everybody. app/main.py:_client_ip
TRUST_PROXY=1

SCAN_CACHE_HOURS=6
USER_AGENT=CyberScorecard/0.1 (+https://<your-domain>)
```

`Ctrl+O`, `Enter`, `Ctrl+X`.

> **MongoDB Atlas:** add `<VM_IP>/32` to the cluster's IP Access List.
> Not `0.0.0.0/0` — the Atlas UI offers that as a convenience and it is
> the most common way a hobby cluster gets found and wiped.

## A7. The service

```bash
sudo tee /etc/systemd/system/boundry.service >/dev/null <<'UNIT'
[Unit]
Description=Boundry - Cyber Risk Scorecard API
After=network-online.target
Wants=network-online.target

[Service]
User=www-data
# `current` is a symlink. systemd resolves it at start, so a restart is
# what moves the service onto a new release.
WorkingDirectory=/srv/boundry/current/backend
EnvironmentFile=/srv/boundry/shared/.env
ExecStart=/srv/boundry/shared/venv/bin/python -m uvicorn app.main:app \
          --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=3

# Hardening. This process scans other people's domains; it has no reason
# to be able to write anywhere but its own temp dir.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable boundry
```

Do **not** start it yet — `current` does not exist until the first deploy.

**Two workers, not one**: a scan holds its worker for up to 30 seconds, so
with one worker the second visitor waits for the first to finish.

## A8. nginx

> **No domain yet?** Use `server_name _;` — the catch-all — and reach the
> site at `http://<VM_IP>`. **No port number**: nginx listens on 80, which
> is what a browser uses by default. The `:5174` and `:8000` of
> development do not exist here.
>
> Then skip A10 entirely and come back to it when you have a domain.

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo tee /etc/nginx/sites-available/boundry >/dev/null <<'CONF'
server {
    listen 80;
    server_name _;          # catch-all: matches any hostname, incl. a bare IP

    # Points at the symlink, never a dated directory.
    root /srv/boundry/current/frontend/dist;
    index index.html;

    # React Router owns the URL space. Any path that is not a real file
    # must return index.html, or /methodology 404s on a hard refresh.
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Hashed filenames, so these can be cached forever.
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # The scan endpoint is Server-Sent Events. Buffering is nginx's
        # default and it breaks streaming completely: every event is held
        # until the response ends, so the user watches a dead progress bar
        # for 25 seconds and then the whole scan lands at once.
        # app/main.py's docstring says the same thing.
        proxy_buffering off;
        proxy_cache off;

        # A scan has a 30s hard limit. 90 leaves room for the report.
        proxy_read_timeout 90s;
    }
}
CONF

sudo ln -sf /etc/nginx/sites-available/boundry /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

`server_name _;` is the no-domain setting. Swap in your real hostname
when you have one (A10).

## A9. First deploy

**On your Mac**, from the repo root:

```bash
./deploy.sh
```

Then visit `http://<VM_IP>`.

## A10. Domain and HTTPS

> **Skip this if you are demoing on the bare IP.** Everything works over
> plain HTTP. But know what the client sees: Chrome puts **"Not secure"**
> in the address bar next to your URL, and this is a product that grades
> other companies on their TLS. It is a bad first frame for a
> five-minute demo.
>
> The fix is a domain, and it is smaller than it sounds — a `.in` or
> `.com` is roughly ₹500–900 for the year, and A2 already gave you a
> static IP to point it at. Budget 30 minutes including DNS propagation.
> You need one before launch regardless, so buying it now costs nothing
> extra and removes the badge.

At your registrar, create an **A record** pointing your domain at
`<VM_IP>`. Wait for it:

```bash
dig +short <your-domain>     # must print <VM_IP>
```

Then, on the VM:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <your-domain> -d www.<your-domain>
```

Choose **redirect HTTP to HTTPS**. Certbot edits the nginx config, gets a
free certificate and installs a renewal timer:

```bash
sudo systemctl list-timers | grep certbot
```

## A11. Lock the door

Port 22 is open to the whole internet by default and will be scanned
within the hour. Restrict it to your own address:

```bash
curl -s ifconfig.me          # on your Mac — your current IP
```

**VPC network → Firewall → `default-allow-ssh` → Edit** → source range
`<that IP>/32`.

> Home broadband IPs change, and you will have to update this when yours
> does. The set-and-forget alternative is to restrict the range to
> Google's IAP block `35.235.240.0/20` instead — but then plain `ssh
> boundry` stops working and you need `gcloud compute ssh`, which means
> installing the Cloud SDK. Pick one; do not leave it at `0.0.0.0/0`.

---

# Part B — shipping a change

Everything below runs **on your Mac**, from the repo root.

```bash
./deploy.sh              # build, upload, switch, verify
./deploy.sh rollback     # back to the previous release, ~2 seconds
./deploy.sh list         # what is on the server, newest first
./deploy.sh status       # is it running?
./deploy.sh logs         # follow the live log
```

### What a deploy does

```
1/6  npm run lint && npm run build     ← lint first, see below
2/6  tar backend + frontend/dist
3/6  scp to the VM
4/6  unpack into releases/<timestamp>, pip install
5/6  move the `current` symlink, restart the service
6/6  curl /api/health on the VM — up to 20 tries
```

**If the health check fails, the script rolls itself back** and exits
non-zero. A broken deploy should not require you to be awake.

**Lint runs before build** because `npm run build` does not catch an
undefined reference — it happily produces a bundle that white-screens at
runtime. That cost `/methodology` a day once.

**`.env` is never in the tarball.** It lives in `shared/` and survives
every deploy.

### Rolling back

```bash
./deploy.sh rollback
```

Moves `current` to the previous release and restarts. No rebuild, no
upload. The last 5 releases are kept.

---

## When to add GitHub Actions

`./deploy.sh` covers about 90% of the benefit of a pipeline. The last 10%
is not having to be at your own laptop.

**Do it after Gate 1 passes**, when you are shipping several times a week.
It is the same script running on GitHub's machine instead of yours: a
workflow on push to `main` that restores the SSH key from a secret and
runs `./deploy.sh`. Nothing here gets thrown away.

## When to add Docker

**Not yet.** Docker's value is reproducibility across environments and you
have one environment. Today it would buy you a rebuild-and-push cycle in
place of a two-second file copy, plus another layer between you and a
stack trace when the SSE stream misbehaves.

It starts paying when a **second service** appears — Redis for rate
limiting, a worker for the Tier 3 connectors, the Tier 5 contract parser.
Those are in [vision.md](vision.md), so it is coming. Adopt it then, on
evidence, rather than now on principle. When you do, only the last three
lines of the workflow change.

---

## Things that will bite you

| Symptom | Cause | Fix |
|---|---|---|
| Progress bar sits still, then the whole report appears at once | nginx is buffering the SSE stream | `proxy_buffering off;` in the `/api/` block |
| `/methodology` works from a link, 404s on refresh | nginx is looking for a file at that path | `try_files $uri $uri/ /index.html;` |
| The 11th scan of the hour fails for a brand-new visitor | `TRUST_PROXY` unset, so every request looks like it came from nginx | `TRUST_PROXY=1` in `shared/.env` |
| Scans run but nothing caches, no share URLs | Atlas is refusing the connection | Add `<VM_IP>/32` to the Atlas IP Access List |
| Attack-surface check 429s and the grade is suppressed | No Cert Spotter key — and the whole server now shares one quota, not just you | Set `CERTSPOTTER_API_KEY` |
| Site vanishes after a VM restart | The external IP was ephemeral | Reserve it as static (A2) |
| `./deploy.sh` says the venv's pip is missing | A5 was skipped | `python3 -m venv /srv/boundry/shared/venv` |
| Deploy succeeds, site still shows old code | Browser cache | Hard refresh. `/assets/` is immutable by design; `index.html` is not cached |

---

## Not covered

- **Staging.** One VM, one environment. A second VM is the cheap version
  when you need one.
- **Scaling.** This handles the demo and early clients comfortably. The
  first thing to break under real load is a 30-second scan holding a
  worker, and the answer then is a task queue, not a bigger VM.
- **The scanner's outbound reputation.** Every scan now leaves from one
  fixed IP carrying your `USER_AGENT`. Point that URL at the company
  domain before launch rather than a GitHub profile — it is the contact
  address a scanned party uses to reach you, and it is part of why
  passive reconnaissance is defensible.
