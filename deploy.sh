#!/usr/bin/env bash
#
# Deploy Boundry (the Cyber Risk Scorecard) to the production VM.
#
#   ./deploy.sh              build, upload, switch, verify
#   ./deploy.sh rollback     go back to the previous release
#   ./deploy.sh list         show what is on the server
#   ./deploy.sh status       is it running?
#   ./deploy.sh logs         follow the live log
#
# RUNS ON YOUR MAC. It talks to the VM over the `boundry` entry in
# ~/.ssh/config.
#
# The server keeps each deploy in its own dated directory and points a
# `current` symlink at one of them:
#
#   /srv/boundry/releases/2026-09-23-114233/   <- older
#   /srv/boundry/releases/2026-09-23-153001/   <- live
#   /srv/boundry/current -> releases/2026-09-23-153001
#   /srv/boundry/shared/.env                   survives every deploy
#   /srv/boundry/shared/venv                   survives every deploy
#
# Switching release is one symlink move, so a rollback is two seconds and
# needs no rebuild. That is the single capability people usually reach for
# Docker to get, and this is the cheap version of it.
#
# If the health check fails after a deploy, this script puts the previous
# release back on its own. A broken deploy should not need you awake.

set -euo pipefail

HOST="${DEPLOY_HOST:-boundry}"
ROOT="${DEPLOY_ROOT:-/srv/boundry}"
SERVICE="${DEPLOY_SERVICE:-boundry}"
KEEP="${DEPLOY_KEEP:-5}"          # releases to retain, including the live one
HEALTH_TRIES=20                   # 20 x 1s — uvicorn boots in about 2
LOCAL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
say()   { printf '  %s\n' "$*"; }
die()   { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }

remote() { ssh "$HOST" "$@"; }

# --- the health check ------------------------------------------------------
# Asks the app itself, on the VM, over localhost — so it tests uvicorn and
# not nginx, TLS or DNS. A deploy that leaves the API dead must fail loudly
# here rather than quietly serving a white page.
verify() {
  remote "bash -s" <<REMOTE
    for i in \$(seq 1 $HEALTH_TRIES); do
      if curl -sf -m 3 http://127.0.0.1:8000/api/health >/dev/null; then
        exit 0
      fi
      sleep 1
    done
    exit 1
REMOTE
}

# --- switch `current` and restart -----------------------------------------
# \`mv -T\` replaces the symlink in one syscall. \`ln -sfn\` on an existing
# link would briefly leave it dangling, and nginx would serve a 404 to
# whoever asked during that window.
activate() {
  local release="$1"
  remote "bash -s" <<REMOTE
    set -euo pipefail
    ln -sfn "$ROOT/releases/$release" "$ROOT/.current.new"
    mv -T "$ROOT/.current.new" "$ROOT/current"
    sudo systemctl restart $SERVICE
REMOTE
}

current_release()  { remote "basename \$(readlink -f $ROOT/current)"; }
previous_release() {
  # Second-newest directory. Empty output means there is nothing to fall
  # back to, which is the state of the very first deploy.
  remote "ls -1 $ROOT/releases | sort -r | sed -n 2p"
}

# ---------------------------------------------------------------------------
cmd_deploy() {
  local release; release="$(date +%Y-%m-%d-%H%M%S)"
  local tarball="/tmp/boundry-$release.tgz"
  local previous; previous="$(current_release 2>/dev/null || true)"

  bold "1/6  Building the frontend"
  ( cd "$LOCAL/frontend" && npm run lint && npm run build ) \
    || die "frontend build failed — nothing was uploaded"
  # `npm run build` alone does not catch an undefined reference; eslint
  # does. That distinction cost a white-screened /methodology once.

  bold "2/6  Packaging"
  # COPYFILE_DISABLE + --no-xattrs: macOS tar otherwise embeds Apple
  # extended attributes that GNU tar on the VM cannot read, and prints a
  # LIBARCHIVE.xattr warning for every single file it unpacks.
  COPYFILE_DISABLE=1 tar czf "$tarball" --no-xattrs \
    --exclude='__pycache__' --exclude='*.pyc' \
    --exclude='.pytest_cache' --exclude='.venv' --exclude='.env' \
    -C "$LOCAL" backend frontend/dist
  say "$(du -h "$tarball" | cut -f1)"

  bold "3/6  Uploading"
  scp -q "$tarball" "$HOST:/tmp/"
  rm -f "$tarball"

  bold "4/6  Unpacking as $release"
  remote "bash -s" <<REMOTE
    set -euo pipefail
    mkdir -p "$ROOT/releases/$release"
    tar xzf "/tmp/$(basename "$tarball")" -C "$ROOT/releases/$release"
    rm -f "/tmp/$(basename "$tarball")"

    # The venv is shared, not per-release: a fresh one on every deploy
    # would add two minutes for dependencies that almost never change.
    # pip is a no-op when requirements.txt has not moved.
    "$ROOT/shared/venv/bin/pip" install -q -r "$ROOT/releases/$release/backend/requirements.txt"

    # nginx runs as www-data and has to be able to read the built files.
    sudo chown -R "\$(id -un):www-data" "$ROOT/releases/$release"
    sudo chmod -R g+rX "$ROOT/releases/$release"
REMOTE

  bold "5/6  Switching over"
  activate "$release"

  bold "6/6  Verifying"
  if verify; then
    say "healthy"
  else
    printf '\033[31m  health check failed\033[0m\n'
    if [ -n "$previous" ]; then
      say "rolling back to $previous"
      activate "$previous"
      verify && say "previous release restored" \
             || say "previous release is ALSO unhealthy — ssh in and look"
    fi
    say "logs:  ./deploy.sh logs"
    exit 1
  fi

  # Keep the last few. Old releases are a few MB each and the only thing
  # standing between you and a bad deploy at an awkward hour.
  remote "cd $ROOT/releases && ls -1 | sort -r | tail -n +$((KEEP + 1)) | xargs -r rm -rf"

  bold "Live: $release"
  remote "ls -1 $ROOT/releases | sort -r | head -n $KEEP | sed 's/^/  /'"
}

cmd_rollback() {
  local previous; previous="$(previous_release)"
  [ -n "$previous" ] || die "no previous release to go back to"
  bold "Rolling back to $previous"
  activate "$previous"
  verify && bold "Live: $previous" || die "rollback is unhealthy — ssh in and look"
}

cmd_list() {
  bold "Releases on $HOST"
  local live; live="$(current_release)"
  remote "ls -1 $ROOT/releases | sort -r" | while read -r r; do
    [ "$r" = "$live" ] && printf '  \033[32m%s  <- live\033[0m\n' "$r" \
                       || printf '  %s\n' "$r"
  done
}

cmd_status() { remote "systemctl status $SERVICE --no-pager -n 15"; }
cmd_logs()   { remote "sudo journalctl -u $SERVICE -f -n 50"; }

case "${1:-deploy}" in
  deploy)   cmd_deploy   ;;
  rollback) cmd_rollback ;;
  list)     cmd_list     ;;
  status)   cmd_status   ;;
  logs)     cmd_logs     ;;
  *)        die "unknown command '$1' — try: deploy | rollback | list | status | logs" ;;
esac
