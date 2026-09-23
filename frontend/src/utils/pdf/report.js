import Doc from './Doc';
import evidenceFor from './evidence';
import { GRADE_META, CHECK_DETAIL, CHECK_LABELS, CHECK_ORDER } from '../../data/gradeMeta';
import { INK, PAGE, TYPE, gradeInk, leading, statusOf } from './theme';
import winAnsi from './winansi';
import {
  deRupee, fileStamp, inr, inrRange, inrRangeCompact, plain, reference, stamp,
} from './money';

/**
 * The downloadable report.
 *
 * **What this document is for.** A founder who runs a scan has three
 * audiences for it and cannot show any of them a browser tab: the engineer
 * who has to do the work, the broker who has to place the risk, and the
 * board member who wants to know what it costs. So the document is
 * organised the way an underwriting file is — summary, findings, plan,
 * exposure, basis — rather than as a transcript of the web page.
 *
 * **Every figure is looked up, never recomputed.** The grade, the score,
 * the premium, the points and the scenario costs are the ones the backend
 * published in the scan payload. A PDF that arrived at a slightly
 * different number than the screen would be the single worst bug this
 * product could ship, so this file does no arithmetic on money at all.
 * The one exception is counting — findings passed, points lost — which is
 * addition over the payload's own values and is asserted in the summary
 * against `available_points`.
 *
 * **It is vector text, not a screenshot.** Selectable, searchable,
 * ~90KB, and it survives being printed. Rasterising the page with
 * html2canvas would have been a tenth of the work and would have produced
 * exactly the artefact the reader is being asked not to think we are.
 *
 * Section order and page breaks are deliberate: each finding is held
 * together by `Doc.keepTogether`, so a DNS record never lands on a
 * different page from the finding it proves.
 */

/* Rule-id prefix → check id. Mirrors RULE_POINTS in scoring/rubric.py,
   which is the only place this relationship is defined. It is how a fix
   finds the finding it answers — the client payload carries each fix's
   `rules` but not each finding's deductions, so the prefix is the join. */
const RULE_TO_CHECK = {
  dmarc: 'dmarc',
  spf: 'spf',
  dkim: 'dkim',
  breach: 'creds',
  creds: 'creds',
  tls: 'tls',
  hdr: 'headers',
  surface: 'subdomains',
};

const checkForFix = (fix) => {
  const rule = fix?.rules?.[0];
  if (!rule) return null;
  return RULE_TO_CHECK[String(rule).split('.')[0]] || null;
};

/* --------------------------------------------------------------------- */
/* Cover                                                                  */
/* --------------------------------------------------------------------- */

function cover(doc, d) {
  const pdf = doc.pdf;

  /* --- masthead ----------------------------------------------------- */
  const bandH = 30;
  pdf.setFillColor(INK.deep);
  pdf.rect(0, 0, PAGE.width, bandH, 'F');
  /* 14mm tall, which sets the cap height of the mark just above the
     wordmark's. `size` is the glyph's height, not its width. */
  doc.logoMark(PAGE.margin, 8, 14);
  doc.line('BOUNDRY', { size: 12, weight: 'bold', spacing: 1.1 }, PAGE.margin + 14, 15.2, {
    colour: INK.onDeep,
  });
  doc.line(
    'Cyber liability, priced on what an insurer can see',
    'micro',
    PAGE.margin + 14,
    19.4,
    { colour: INK.onDeepMuted },
  );
  doc.line('CYBER RISK', 'eyebrow', doc.right, 14, { colour: INK.onDeepMuted, align: 'right' });
  doc.line('ASSESSMENT', 'eyebrow', doc.right, 18.2, { colour: INK.onDeepMuted, align: 'right' });

  doc.y = bandH + 10;

  /* --- reference strip ---------------------------------------------- */
  doc.dataRow('Reference', d.reference, { mono: true, labelWidth: 34 });
  doc.dataRow('Domain assessed', d.domain, { mono: true, labelWidth: 34 });
  doc.dataRow('Assessed at', d.stampedAt, { labelWidth: 34 });
  doc.dataRow('Rules applied', `Scoring rules ${d.rubricVersion} · Rate card ${d.rateVersion}`, {
    labelWidth: 34,
  });
  doc.gap(6);

  /* --- subject ------------------------------------------------------- */
  if (d.company) {
    doc.text(d.company, 'h1', { colour: INK.ink });
    doc.gap(1.5);
  }
  if (d.whatTheyDo) {
    doc.text(d.whatTheyDo, 'lead', { colour: INK.muted, width: 150 });
    doc.gap(1.5);
  }
  if (d.profileLine) {
    doc.text(d.profileLine, 'caption', { colour: INK.faint });
  }
  doc.gap(6);

  /* --- the verdict panel --------------------------------------------- */
  const panelH = 36;
  const top = doc.panel(panelH, { fill: INK.raised, stroke: INK.line, radius: 2.4 });
  const colour = gradeInk(d.grade);

  /* Grade, set at 42pt. The one piece of the document that has to work
     from across a meeting-room table. */
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(TYPE.grade.size);
  pdf.setCharSpace(0);
  pdf.setTextColor(colour);
  pdf.text(winAnsi(d.grade), PAGE.margin + 16, top + 24, { align: 'center' });

  doc.line(`${d.score} / 100`, 'caption', PAGE.margin + 16, top + 31, {
    colour: INK.faint,
    align: 'center',
  });

  pdf.setDrawColor(INK.lineStrong);
  pdf.setLineWidth(0.2);
  pdf.line(PAGE.margin + 32, top + 7, PAGE.margin + 32, top + panelH - 7);

  const textX = PAGE.margin + 39;
  const textW = PAGE.content - 39 - 4;
  doc.y = top + 8;
  doc.text(d.gradeSummary, 'h4', { x: textX, width: textW, colour: INK.ink });
  doc.gap(1.2);
  doc.text(d.scoreExplainer, 'caption', { x: textX, width: textW, colour: INK.muted });
  doc.y = top + panelH + 6;

  /* --- premium -------------------------------------------------------- */
  doc.sectionLabel('Estimated annual premium');
  doc.text(d.premiumLabel, 'figure', { colour: INK.ink });
  doc.gap(1.5);
  doc.text(d.premiumBasis, 'caption', { colour: INK.muted, width: 150 });
  doc.gap(5);

  /* --- contents -------------------------------------------------------
     Above the table, not under it. The seven-check table breaks across a
     page gracefully — its head is redrawn — but a four-row contents list
     does not, and on the first run two of its rows were stranded alone on
     page 2 under a running head. The block that tolerates a break goes
     last. */
  doc.keepTogether((k) => {
    k.sectionLabel('In this report');
    d.contents.forEach(([title, blurb]) => {
      k.dataRow(title, blurb, { labelWidth: 46, rule: true });
    });
  });
  doc.gap(5);

  /* --- at a glance ---------------------------------------------------- */
  doc.sectionLabel('The seven checks');
  doc.table(
    [
      { key: 'n', head: '#', width: 8, style: 'caption', ink: INK.faint },
      { key: 'label', head: 'Check', width: 58, style: 'caption' },
      { key: 'detail', head: 'What we found', width: 72, style: 'caption', ink: INK.muted },
      { key: 'status', head: 'Result', width: 22, style: 'caption', ink: (r) => statusOf(r.raw).ink },
      { key: 'points', head: 'Lost', width: 18, align: 'right', style: 'caption', ink: (r) => (r.lost ? statusOf(r.raw).ink : INK.faint) },
    ],
    d.summaryRows,
  );

  doc.gap(2);
  doc.text(d.pointsLine, 'caption', { colour: INK.muted });

}

/* --------------------------------------------------------------------- */
/* Findings                                                               */
/* --------------------------------------------------------------------- */

function findings(doc, d) {
  doc.newPage();
  doc.heading('Findings, check by check', { style: 'h2', space: 2 });
  doc.text(
    'Each check below states what was looked at, what came back, why an underwriter '
    + 'cares, and — where something failed — the work that closes it. The boxed lines '
    + 'are the raw records as they were returned; they can be re-run from any terminal '
    + 'and should give the same answer.',
    'body',
    { colour: INK.muted, width: 165 },
  );
  doc.gap(7);

  d.findings.forEach((f, index) => {
    finding(doc, f, index + 1);
    if (index < d.findings.length - 1) separator(doc);
  });
}

/**
 * The space between two findings.
 *
 * Findings used to be wrapped in `keepTogether`, which moved any finding
 * that did not fit whole onto a fresh page. It guaranteed a record never
 * left its heading behind — and it cost roughly a third of every page in
 * white space, turning a five-page document into nine.
 *
 * They flow now. What is held together is the *opening* of a finding: the
 * heading, the result, and enough of the explanation that a page never
 * ends on a title alone. The evidence panel manages its own break, so a
 * DNS record still moves whole rather than splitting down the middle.
 */
function separator(doc) {
  doc.gap(5);
  doc.rule({ colour: INK.line });
  doc.gap(5);
}

function finding(doc, f, n) {
  const pdf = doc.pdf;
  const status = statusOf(f.status);

  /* Keep the heading with the first thing it says. Measured, not guessed:
     the header row, the finding line and the first paragraph under it.
     Anything past that may break to the next page — the evidence panel
     takes care of itself. */
  doc.need(
    9
    + doc.measure(f.detail || '', 'h4', PAGE.content - 8)
    + doc.measure(f.what || '', 'body', PAGE.content - 8),
  );

  /* --- header row ----------------------------------------------------- */
  const headBase = doc.y + 3.4;
  doc.numberDot(n, PAGE.margin + 2.5, headBase - 1.2, {
    ink: status.ink,
    fill: status.fill,
  });
  doc.line(f.label, 'h3', PAGE.margin + 8, headBase, { colour: INK.ink });

  const chipW = doc.chip(status.label, status, doc.right, headBase);
  if (f.maxPoints != null) {
    doc.line(
      f.lost ? `${f.lost} of ${f.maxPoints} pts lost` : `${f.maxPoints} pts at risk`,
      'caption',
      doc.right - chipW - 5,
      headBase,
      { colour: INK.faint, align: 'right' },
    );
  }
  doc.y = headBase + 2.4;
  doc.rule({ colour: INK.lineStrong, width: 0.3 });
  doc.gap(3.4);

  const bodyX = PAGE.margin + 8;
  const bodyW = PAGE.content - 8;

  /* The finding itself, set heavier than the explanation under it — this
     is the sentence a reader skimming the document actually stops on. */
  if (f.detail) {
    doc.text(f.detail, 'h4', { x: bodyX, width: bodyW, colour: status.ink });
    doc.gap(2.4);
  }
  if (f.what) {
    doc.text(f.what, 'body', { x: bodyX, width: bodyW, colour: INK.muted });
    doc.gap(1.8);
  }
  if (f.why) {
    doc.text(f.why, 'body', { x: bodyX, width: bodyW, colour: INK.muted });
    doc.gap(3);
  }

  /* --- observed record ------------------------------------------------ */
  if (f.evidence) evidenceBlock(doc, f.evidence, bodyX, bodyW);

  /* --- what to do ----------------------------------------------------- */
  if (f.fix) remedyBlock(doc, f.fix, bodyX, bodyW);

  if (!f.fix && f.status === 'pass') {
    doc.gap(1);
    doc.text(
      'Nothing to do. This is what an underwriter expects to see.',
      'caption',
      { x: bodyX, width: bodyW, colour: INK.faint },
    );
  }
  pdf.setCharSpace(0);
}

function evidenceBlock(doc, ev, x, width) {
  const pdf = doc.pdf;
  const inner = width - 8;

  /* Measure the whole panel before drawing any of it: jsPDF has no
     z-index, so the background has to be laid down first and it cannot be
     laid down until its height is known. */
  let h = 4.5; // label
  if (ev.command) h += leading(TYPE.caption.size, 1.4);
  if (ev.record) h += leading(TYPE.caption.size, 1.4) * doc.pdf.splitTextToSize(winAnsi(ev.record), inner - 5).length + 3.6;
  if (ev.empty) h += doc.measure(ev.empty, 'caption', inner);
  ev.rows.forEach((row) => {
    h += leading(TYPE.caption.size, 1.34)
      * Math.max(1, pdf.splitTextToSize(winAnsi(row.value), inner - 40).length) + 1.2;
    if (row.after) h += doc.measure(row.after, 'micro', inner - 40) + 0.8;
  });
  if (ev.hosts.length) h += 3.4 + ev.hosts.length * 4.3;
  if (ev.note) h += doc.measure(ev.note, 'micro', inner) + 2;
  h += 4;

  /* `need` may move us to a new page, so the panel's top is read back
     AFTER it rather than from `start`. Getting this wrong drew the fill
     at the old cursor and the text at the new one. */
  doc.need(Math.min(h, doc.bottom - PAGE.top));
  const panelTop = doc.y;
  doc.panel(h, { fill: INK.sunken, stroke: null, radius: 1.6, x, width });

  doc.y = panelTop + 3.4;
  const ix = x + 4;

  doc.line('WHAT WE READ', 'eyebrow', ix, doc.y, { colour: INK.faint });
  doc.y += 3.6;

  if (ev.command) {
    doc.mono(TYPE.caption.size);
    pdf.setTextColor(INK.faint);
    pdf.text(winAnsi(ev.command), ix, doc.y + leading(TYPE.caption.size, 1.4) * 0.72);
    doc.y += leading(TYPE.caption.size, 1.4);
  }

  if (ev.record) {
    doc.mono(TYPE.caption.size);
    const lines = pdf.splitTextToSize(winAnsi(ev.record), inner - 5);
    const step = leading(TYPE.caption.size, 1.4);
    const boxH = lines.length * step + 2.6;
    pdf.setFillColor(INK.white);
    pdf.setDrawColor(INK.line);
    pdf.setLineWidth(0.2);
    pdf.roundedRect(ix, doc.y, inner, boxH, 0.9, 0.9, 'FD');
    doc.mono(TYPE.caption.size);
    pdf.setTextColor(INK.ink);
    lines.forEach((l, i) => pdf.text(l, ix + 2.5, doc.y + 1.3 + step * (i + 0.72)));
    doc.y += boxH + 2.4;
  }

  if (ev.empty) {
    doc.text(ev.empty, 'caption', { x: ix, width: inner, colour: INK.muted });
    doc.gap(1);
  }

  ev.rows.forEach((row) => {
    const step = leading(TYPE.caption.size, 1.34);
    doc.line(row.label, 'caption', ix, doc.y + step * 0.72, { colour: INK.faint });
    if (row.mono) doc.mono(TYPE.caption.size);
    else doc.font('caption');
    pdf.setTextColor(INK.ink);
    const lines = pdf.splitTextToSize(winAnsi(row.value), inner - 40);
    lines.forEach((l, i) => pdf.text(l, ix + 40, doc.y + step * (i + 0.72)));
    doc.y += lines.length * step + 1.2;
    if (row.after) {
      doc.text(row.after, 'micro', { x: ix + 40, width: inner - 40, colour: INK.faint });
      doc.gap(0.8);
    }
  });

  if (ev.hosts.length) {
    doc.y += 1.6;
    doc.line('Reachable and named like something internal', 'micro', ix, doc.y, {
      colour: INK.faint,
    });
    doc.y += 2.4;
    ev.hosts.forEach((host) => {
      doc.mono(TYPE.caption.size);
      pdf.setTextColor(INK.ink);
      pdf.text(winAnsi(host.host), ix, doc.y + 3);
      pdf.setTextColor(INK.faint);
      pdf.text(winAnsi([host.status, host.server].filter(Boolean).join('  ·  ')), x + width - 4, doc.y + 3, {
        align: 'right',
      });
      doc.y += 4.3;
      pdf.setDrawColor(INK.line);
      pdf.setLineWidth(0.2);
      pdf.line(ix, doc.y - 1.2, x + width - 4, doc.y - 1.2);
    });
  }

  if (ev.note) {
    doc.y += 1.4;
    doc.text(ev.note, 'micro', { x: ix, width: inner, colour: INK.faint });
  }

  doc.y = panelTop + h + 3.4;
}

function remedyBlock(doc, fix, x, width) {
  const pdf = doc.pdf;
  doc.gap(1);

  /* Measured and kept whole. This block was the one thing in the document
     with no break of its own, so a finding that ended near the foot of a
     page printed its remedy straight through the footer rule. Four or
     five lines always fit on a fresh page, so moving it whole is safe. */
  doc.need(
    12
    + doc.measure(fix.title, 'h4', width - 6)
    + doc.measure(fix.how, 'body', width - 6),
  );

  /* An accent rule down the left edge rather than another box. The
     evidence above is already a panel, and a panel inside a panel inside a
     page turns the document into a stack of trays. */
  const start = doc.y;
  const inner = width - 6;

  doc.line('WHAT TO DO', 'eyebrow', x + 6, doc.y + 2.6, { colour: INK.accent });
  doc.y += 4.6;
  doc.text(fix.title, 'h4', { x: x + 6, width: inner, colour: INK.ink });
  doc.gap(1.4);
  doc.text(fix.how, 'body', { x: x + 6, width: inner, colour: INK.muted });
  doc.gap(2);

  const bits = [
    `Effort  ${fix.effort}`,
    `Recovers  ${fix.points} points`,
    fix.saving ? `Premium saving  ${inr(fix.saving)}/yr` : null,
    `Priority  ${fix.priority}`,
  ].filter(Boolean);
  doc.mono(TYPE.micro.size);
  pdf.setTextColor(INK.muted);
  pdf.text(winAnsi(bits.join('     ')), x + 6, doc.y + 2);
  doc.y += 3.6;

  pdf.setDrawColor(INK.accent);
  pdf.setLineWidth(0.7);
  pdf.line(x + 1.2, start + 0.6, x + 1.2, doc.y - 1);
  pdf.setLineWidth(0.2);
}

/* --------------------------------------------------------------------- */
/* Remediation plan                                                       */
/* --------------------------------------------------------------------- */

function plan(doc, d) {
  if (!d.fixes.length) return;
  doc.newPage();
  doc.heading('The plan, best value first', { style: 'h2', space: 2 });
  doc.text(
    'Ordered by what each item returns for the time it takes, not by severity. '
    + 'Points are the score this recovers; the premium column is what that grade '
    + 'change is worth against the same rate card row.',
    'body',
    { colour: INK.muted, width: 165 },
  );
  doc.gap(6);

  doc.table(
    [
      { key: 'priority', head: '#', width: 8, style: 'caption', ink: INK.faint },
      { key: 'title', head: 'What to do', width: 74, style: 'caption' },
      { key: 'area', head: 'Area', width: 32, style: 'caption', ink: INK.faint },
      { key: 'effort', head: 'Effort', width: 22, style: 'caption', ink: INK.muted },
      { key: 'points', head: 'Points', width: 20, align: 'right', style: 'caption' },
      { key: 'saving', head: 'INR/yr', width: 22, align: 'right', style: 'caption', ink: INK.muted },
    ],
    d.planRows,
    { zebra: true },
  );

  doc.gap(5);

  /* --- the payoff ----------------------------------------------------- */
  if (d.allFixed) {
    const h = 30;
    const top = doc.panel(h, { fill: INK.deep, stroke: null, radius: 2.4 });
    doc.line('IF EVERY ITEM ABOVE IS DONE', 'eyebrow', PAGE.margin + 6, top + 7, {
      colour: INK.onDeepMuted,
    });

    /* "D to A", not "D -> A". The arrow is not WinAnsi, so `winAnsi`
       reads it as '->' — correct, but it sets as two glyphs with a space
       either side and looks like a typo in a 9pt figure. */
    const cells = [
      ['Grade', `${d.grade} to ${d.allFixed.grade}`],
      ['Score', `${d.score} to ${d.allFixed.score}`],
      ['Premium', d.allFixed.premiumLabel],
      ['Saving', `${inr(d.allFixed.saving)}/yr`],
      ['Effort', d.allFixed.effort],
    ];
    const colW = (PAGE.content - 12) / cells.length;
    cells.forEach(([label, value], i) => {
      const cx = PAGE.margin + 6 + colW * i;
      doc.line(label, 'micro', cx, top + 15, { colour: INK.onDeepMuted });
      doc.line(value, 'h4', cx, top + 22.5, { colour: INK.onDeep });
    });
    doc.y = top + h + 5;

    doc.text(
      'Ticking a box does not close a finding — doing the work does, and a re-scan is '
      + 'what proves it. The premium above is the same rate card row applied to the '
      + 'better grade; it is not a quote and no insurer has seen it.',
      'caption',
      { colour: INK.faint, width: 165 },
    );
  }

  /* --- strengths ------------------------------------------------------- */
  if (d.strengths.length) {
    doc.gap(8);
    doc.sectionLabel('What is already right');
    d.strengths.forEach((s) => {
      doc.text(`—   ${s}`, 'body', { colour: INK.muted, x: PAGE.margin + 2, width: PAGE.content - 2 });
      doc.gap(1.2);
    });
  }
}

/* --------------------------------------------------------------------- */
/* Exposure                                                               */
/* --------------------------------------------------------------------- */

function exposure(doc, d) {
  const s = d.scenario;
  if (!s || s.empty) return;
  doc.newPage();
  doc.heading('What this costs if it happens', { style: 'h2', space: 2 });
  doc.text(
    'The exposure carrying the most weight in this assessment, costed at typical '
    + 'Indian market figures for a company of this size. Every line below except the '
    + 'narrative is quoted verbatim from a published catalogue — cost bands, what a '
    + 'policy covers, what it sublimits and what it excludes are never generated.',
    'body',
    { colour: INK.muted, width: 165 },
  );
  doc.gap(7);

  doc.heading(s.title, { style: 'h3', space: 2 });
  if (s.narrative) {
    doc.text(s.narrative, 'body', { colour: INK.muted, width: 165 });
    doc.gap(5);
  }

  doc.table(
    [
      { key: 'label', head: 'Cost line', width: 120, style: 'caption' },
      { key: 'range', head: 'Typical range', width: 58, align: 'right', style: 'caption', ink: INK.muted },
    ],
    s.rows,
  );

  /* Total, set apart. */
  doc.gap(0.5);
  const baseline = doc.y + 3;
  doc.line('Typical total', 'h4', PAGE.margin, baseline, { colour: INK.ink });
  doc.line(s.total, 'h4', doc.right, baseline, { colour: INK.ink, align: 'right' });
  doc.y = baseline + 2.4;
  doc.rule({ colour: INK.lineStrong, width: 0.35 });
  doc.gap(8);

  /* --- cover ----------------------------------------------------------- */
  doc.sectionLabel('How a policy responds');
  doc.dataRow('Covered', s.covered, { labelWidth: 34, valueInk: INK.ink });
  if (s.sublimit) {
    doc.gap(1);
    doc.text(s.sublimit, 'caption', {
      x: PAGE.margin + 34,
      width: PAGE.content - 34,
      colour: '#8a5a00',
    });
    doc.gap(2.4);
    doc.rule({ colour: INK.line });
    doc.gap(1.6);
  }
  doc.dataRow('Not covered', s.notCovered, { labelWidth: 34, valueInk: INK.ink });
  doc.gap(4);
  doc.text(
    'Typical figures, estimated — not a claims history and not a promise of cover. '
    + 'What any particular policy pays depends on its own wording and its own schedule '
    + 'of sublimits.',
    'micro',
    { colour: INK.faint, width: 165 },
  );

  /* --- limit ----------------------------------------------------------- */
  if (d.coverage) {
    doc.gap(9);
    doc.sectionLabel('How much cover this suggests');
    doc.text(d.coverage.headline, 'h3', { colour: INK.ink });
    doc.gap(2);
    doc.text(d.coverage.reasoning, 'body', { colour: INK.muted, width: 165 });
    if (d.coverage.downside) {
      doc.gap(2);
      doc.text(d.coverage.downside, 'body', { colour: INK.muted, width: 165 });
    }
    doc.gap(5);
    doc.table(
      [
        { key: 'limit', head: 'Limit', width: 40, style: 'caption' },
        { key: 'premium', head: 'Premium at this grade', width: 90, style: 'caption', ink: INK.muted },
        { key: 'note', head: '', width: 48, align: 'right', style: 'caption', ink: INK.accent },
      ],
      d.coverage.rows,
    );
  }
}

/* --------------------------------------------------------------------- */
/* Basis                                                                  */
/* --------------------------------------------------------------------- */

function basis(doc, d) {
  doc.newPage();
  doc.heading('Basis of this assessment', { style: 'h2', space: 2 });
  doc.text(
    'Published so it can be argued with. No insurer grants underwriting authority to '
    + 'something it cannot inspect, and neither should a reader.',
    'body',
    { colour: INK.muted, width: 165 },
  );
  doc.gap(7);

  doc.sectionLabel('How the score is built');
  doc.text(
    `Every domain starts at 100 and loses points for what is found. Absence of a `
    + `problem is the normal state, so the rubric deducts rather than rewards. This `
    + `assessment was scored over ${d.availablePoints} measurable points under scoring `
    + `rules ${d.rubricVersion}; a check that could not be completed has its points `
    + `withdrawn from the denominator rather than being scored as a pass. The weights `
    + `are ours — judgement, published and versioned, not actuarial — and they follow `
    + `what shows up in a claim file rather than what a security tool would rank highest.`,
    'body',
    { colour: INK.muted, width: 168 },
  );
  doc.gap(6);

  doc.sectionLabel('How the premium is reached');
  doc.text(
    `Two inputs only: the grade above and the revenue band inferred for this company. `
    + `Those pick one row of a published rate card — ${d.rateVersion} — and the cover `
    + `amount follows the band. Industry, data types and DPDP applicability are held `
    + `but deliberately not priced on, because each is inferred from a website and a `
    + `number that can be traced beats a number that merely looks precise.`,
    'body',
    { colour: INK.muted, width: 168 },
  );
  doc.gap(3);
  doc.dataRow('Rate card row', d.premiumBasis, { labelWidth: 42 });
  doc.dataRow('Assessed premium', d.premiumLabel, { labelWidth: 42, valueInk: INK.ink });
  doc.gap(6);

  doc.sectionLabel('What was not looked at');
  doc.text(
    'This assessment reads only what the domain already publishes: DNS records, the '
    + 'TLS certificate, HTTP response headers and public certificate transparency logs. '
    + 'No port was scanned, no vulnerability was probed, no input was fuzzed and no '
    + 'credential was tested. Every request carried a truthful User-Agent naming its '
    + 'operator. It follows that the assessment cannot see revenue, internal controls, '
    + 'MFA enforcement, backup practice, or claims history — which is precisely why '
    + 'this is an estimate and not a proposal form.',
    'body',
    { colour: INK.muted, width: 168 },
  );
  doc.gap(6);

  doc.sectionLabel('Standing on this document');
  [
    ['Not a quote', 'No insurer has seen this assessment. The premium is an estimate of the Indian cyber market, sanity-checked against published broker ranges and pending insurer validation.'],
    ['Not a policy', 'Nothing here creates, varies or confirms cover. What a policy pays is decided by its own wording and schedule.'],
    ['Reproducible', `The same domain scanned again under rules ${d.rubricVersion} against unchanged records produces this grade again. Every point traces to a published rule.`],
    ['Point in time', `Findings describe what was published at ${d.stampedAt}. A record changed an hour later is not reflected here.`],
  ].forEach(([label, body]) => doc.dataRow(label, body, { labelWidth: 34 }));

  doc.gap(7);
  doc.text(
    `${d.reference}  ·  ${d.domain}  ·  ${d.stampedAt}`,
    'micro',
    { colour: INK.faint },
  );
}

/* --------------------------------------------------------------------- */
/* Assembly                                                               */
/* --------------------------------------------------------------------- */

/**
 * Flatten the scan into exactly what the pages need.
 *
 * Done once, here, rather than inside the page functions: a layout routine
 * that also decides what a number means is a layout routine that will
 * eventually disagree with the screen.
 */
export function collect({ result, profile, checks, simulated, domain }) {
  const grade = result.grade;
  const meta = GRADE_META[grade] || {};
  const scannedAt = result.scanned_at;

  /* The premium shown is the one the rail shows — the chosen limit's price
     for the grade actually held. `simulated` is the single source for it,
     exactly as on screen, so the two can never disagree. */
  const premium = simulated?.premium ?? result.premium;
  const limitLabel = deRupee(
    result.coverage?.options?.find((o) => o.limit === (simulated?.limit ?? result.premium?.limit))
      ?.limit_label
    ?? result.coverage?.recommended_limit_label
    ?? '',
  );

  const byId = new Map((checks || []).map((c) => [c.id, c]));
  const fixes = result.fixes || [];
  const fixByCheck = new Map();
  fixes.forEach((fix) => {
    const id = checkForFix(fix);
    if (id && !fixByCheck.has(id)) fixByCheck.set(id, fix);
  });

  const findingRows = CHECK_ORDER.map((id) => {
    const check = byId.get(id) || {};
    const detail = CHECK_DETAIL[id] || {};
    const fix = fixByCheck.get(id);
    const lost = fix?.score_delta ?? 0;
    return {
      id,
      label: check.label || CHECK_LABELS[id] || id,
      status: check.status && check.status !== 'pending' ? check.status : 'inconclusive',
      detail: check.detail || '',
      what: detail.what,
      why: detail.why,
      maxPoints: detail.points,
      lost,
      evidence: evidenceFor(id, check.evidence),
      fix: fix && {
        title: fix.title,
        how: fix.how_to_fix,
        effort: fix.effort,
        points: fix.score_delta,
        saving: fix.annual_saving,
        priority: fix.priority,
      },
    };
  });

  const failed = findingRows.filter((f) => f.status === 'fail' || f.status === 'warn').length;
  const lostTotal = findingRows.reduce((t, f) => t + (f.lost || 0), 0);

  const combined = result.combined_if_all_fixed;

  return {
    domain,
    reference: reference(result.scan_id, scannedAt),
    stampedAt: stamp(scannedAt),
    fileStamp: fileStamp(scannedAt),
    rubricVersion: result.rubric_version || '—',
    rateVersion: result.rate_version || '—',
    availablePoints: result.available_points ?? 100,

    company: profile?.company_name || domain,
    whatTheyDo: profile?.what_they_do || '',
    profileLine: [
      profile?.industry,
      profile?.business_model?.replace(/_/g, ' '),
      profile?.estimated_size_band ? `${profile.estimated_size_band} people` : null,
      profile?.data_types_handled?.length ? `handles ${profile.data_types_handled.join(', ')}` : null,
      profile?.dpdp_act_applies ? 'DPDP applies' : null,
    ].filter(Boolean).join('   ·   '),

    grade,
    score: result.score,
    gradeSummary: result.headline || meta.summary || '',
    scoreExplainer: `${result.score} of a possible 100, scored over ${
      result.available_points ?? 100
    } measurable points. ${
      failed
        ? `${failed} of 7 checks need attention. ${lostTotal} points are recoverable through the plan set out in this report.`
        : 'Nothing an underwriter can see from outside stands out as a problem.'
    }`,

    premiumLabel: inrRange(premium),
    premiumBasis: [
      limitLabel ? `for ${limitLabel} of cover` : null,
      profile?.estimated_size_band ? `company size ${profile.estimated_size_band}` : null,
      `grade ${grade}`,
      `rate card ${result.rate_version || '—'}`,
    ].filter(Boolean).join(', '),

    summaryRows: findingRows.map((f, i) => ({
      n: String(i + 1),
      label: f.label,
      detail: f.detail,
      status: statusOf(f.status).label,
      raw: f.status,
      points: f.lost ? `-${f.lost}` : '0',
      lost: f.lost,
    })),
    pointsLine: lostTotal
      ? `${lostTotal} points deducted across ${failed} check${failed === 1 ? '' : 's'}. Every deduction traces to a numbered rule in scoring rules ${result.rubric_version}.`
      : 'No points deducted. Every check returned what an underwriter expects to see.',

    contents: [
      ['Findings', 'Each check, what was read, and the work that closes it'],
      ['The plan', 'Every fix, ordered by what it returns for the time it takes'],
      ['Exposure', 'What the heaviest finding costs if it happens, and how a policy responds'],
      ['Basis', 'How the score and the premium are built, and what was not looked at'],
    ],

    findings: findingRows,

    fixes,
    planRows: fixes.map((fix) => ({
      priority: String(fix.priority ?? ''),
      title: fix.title,
      area: CHECK_LABELS[checkForFix(fix)] || '—',
      effort: fix.effort,
      points: `+${fix.score_delta}`,
      saving: fix.annual_saving ? plain(fix.annual_saving) : '—',
    })),
    allFixed: combined && {
      grade: combined.grade,
      score: combined.score,
      premiumLabel: inrRange(combined.premium),
      saving: combined.annual_saving,
      effort: combined.total_effort_hours
        ? `${combined.total_effort_hours} hrs`
        : '—',
    },
    strengths: result.strengths || [],

    scenario: result.scenario && !result.scenario.empty && {
      title: result.scenario.title,
      narrative: result.scenario.narrative,
      rows: (result.scenario.cost_lines || []).map((l) => ({
        label: l.label,
        range: inrRangeCompact(l),
      })),
      total: inrRangeCompact(result.scenario.total),
      covered: (result.scenario.covered || []).join('  ·  '),
      sublimit: result.scenario.sublimit_warning,
      notCovered: result.scenario.not_covered,
      empty: false,
    },

    coverage: result.coverage?.rationale && {
      headline: deRupee(result.coverage.rationale.headline),
      reasoning: deRupee(result.coverage.rationale.reasoning),
      downside: deRupee(result.coverage.rationale.downside),
      rows: (result.coverage.options || []).map((o) => ({
        limit: deRupee(o.limit_label),
        premium: inrRange(o.by_grade?.[grade] || o.premium),
        note: o.limit === result.coverage.recommended_limit ? 'RECOMMENDED' : '',
      })),
    },
  };
}

/** Build the document. Returns the jsPDF instance. */
export function buildReport(jsPDFClass, data) {
  const doc = new Doc(jsPDFClass, { subject: data.domain });

  doc.pdf.setProperties({
    title: `Boundry cyber risk assessment — ${data.domain}`,
    subject: `${data.reference} · grade ${data.grade} · ${data.stampedAt}`,
    author: 'Boundry',
    creator: 'Boundry',
    keywords: 'cyber liability, risk assessment, India',
  });

  cover(doc, data);
  findings(doc, data);
  plan(doc, data);
  exposure(doc, data);
  basis(doc, data);

  doc.finish(
    `${data.reference}  ·  Passive checks only  ·  Estimate, not a quote  ·  Scoring ${data.rubricVersion} / rate ${data.rateVersion}`,
  );
  return doc.pdf;
}

export const filenameFor = (data) =>
  `Boundry-${String(data.domain).replace(/[^a-z0-9.-]/gi, '')}-${data.fileStamp}.pdf`;
