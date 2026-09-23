import { INK, PAGE, TYPE, gradeInk, leading, pt, statusOf } from './theme';
import winAnsi from './winansi';

/**
 * A typesetting layer over jsPDF.
 *
 * jsPDF draws at coordinates. A document flows. Everything below exists to
 * close that gap: a cursor that advances, blocks that measure themselves
 * before they commit, and a page break that happens because a block did
 * not fit rather than because someone counted lines by hand.
 *
 * **`keepTogether` is the reason this class exists.** A finding split
 * across a page boundary — the heading on one page, the DNS record that
 * proves it on the next — is how a generated PDF announces that it was
 * generated. Blocks that must not break are measured into a scratch
 * document first and moved to a new page whole.
 *
 * Nothing in here knows anything about scans. It knows about pages, rules,
 * panels and tables.
 *
 * **Every string is routed through `winAnsi` on the way out.** The
 * standard PDF faces silently drop characters they cannot encode, so a
 * non-breaking hyphen arriving from the AI layer would vanish mid-word
 * with no error raised anywhere. Sanitising at this boundary is the only
 * place it can be done once — see `winansi.js`.
 */
export default class Doc {
  constructor(jsPDFClass, { subject } = {}) {
    this.pdf = new jsPDFClass({ unit: 'mm', format: 'a4', compress: true });
    this.jsPDFClass = jsPDFClass;
    this.subject = subject || '';
    this.y = PAGE.top;
    this.pageNo = 1;
    this.mastheadDrawn = false;
    /* Running heads are stamped at the end, once the page count is known —
       "page 3 of 9" cannot be written on page 3 while the document is
       still growing. */
    this.pdf.setLineJoin('round');
    this.pdf.setLineCap('round');
  }

  /* --- state ---------------------------------------------------------- */

  get bottom() {
    return PAGE.height - PAGE.bottom;
  }

  get left() {
    return PAGE.margin;
  }

  get right() {
    return PAGE.width - PAGE.margin;
  }

  font(style) {
    const spec = typeof style === 'string' ? TYPE[style] : style;
    this.pdf.setFont('helvetica', spec.weight === 'bold' ? 'bold' : 'normal');
    this.pdf.setFontSize(spec.size);
    this.pdf.setCharSpace(spec.spacing || 0);
    this._spec = spec;
    return spec;
  }

  mono(size = TYPE.caption.size, weight = 'normal') {
    this.pdf.setFont('courier', weight);
    this.pdf.setFontSize(size);
    this.pdf.setCharSpace(0);
    this._spec = { size, weight };
    return this._spec;
  }

  ink(colour) {
    this.pdf.setTextColor(colour);
    return this;
  }

  /**
   * The width a string will actually occupy.
   *
   * **jsPDF measures and draws differently.** `getTextWidth` and
   * `splitTextToSize` both ignore `setCharSpace` entirely, while `text`
   * applies it after every glyph. Any tracked string is therefore wider
   * on the page than anything that measured it believes — which is how
   * the FAILED chip ended up sitting on top of the points beside it.
   *
   * Everything that needs a width for layout goes through this. Flowed
   * paragraphs do not need it because they are never tracked: only
   * eyebrows carry `spacing`, and an eyebrow is always one short line.
   */
  trackedWidth(text) {
    const safe = winAnsi(text);
    const spacing = this._spec?.spacing || 0;
    return this.pdf.getTextWidth(safe) + spacing * safe.length;
  }

  /* --- pages ---------------------------------------------------------- */

  /** Room for `height` mm, or a new page. */
  need(height) {
    if (this.y + height <= this.bottom) return false;
    this.newPage();
    return true;
  }

  newPage() {
    this.pdf.addPage();
    this.pageNo += 1;
    this.y = PAGE.top;
    this.runningHead();
    return this;
  }

  /** The slim head on every page after the cover. */
  runningHead() {
    const pdf = this.pdf;
    this.font('eyebrow');
    pdf.setTextColor(INK.faint);
    pdf.text('BOUNDRY  ·  CYBER RISK ASSESSMENT', this.left, this.y);
    if (this.subject) {
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(TYPE.eyebrow.size);
      pdf.setCharSpace(0);
      pdf.text(winAnsi(this.subject), this.right, this.y, { align: 'right' });
    }
    this.y += 2.2;
    this.rule();
    this.y += 5;
    return this;
  }

  /**
   * Page numbers, stamped across every page once the total is known.
   * Also the standing footer, which is a compliance line and not
   * decoration: a reader who prints one page out of nine must still have
   * "estimate, not a quote" in front of them.
   */
  finish(footerNote) {
    const total = this.pdf.getNumberOfPages();
    for (let page = 1; page <= total; page += 1) {
      this.pdf.setPage(page);
      const y = PAGE.height - PAGE.bottom + 6;
      this.pdf.setDrawColor(INK.line);
      this.pdf.setLineWidth(0.2);
      this.pdf.line(this.left, y - 3.4, this.right, y - 3.4);
      this.font('micro');
      this.pdf.setTextColor(INK.faint);
      this.pdf.text(winAnsi(footerNote), this.left, y);
      this.pdf.text(`${page} of ${total}`, this.right, y, { align: 'right' });
    }
    return this;
  }

  /* --- rules and space ------------------------------------------------ */

  rule({ colour = INK.line, width = 0.2, indent = 0, y = null } = {}) {
    this.pdf.setDrawColor(colour);
    this.pdf.setLineWidth(width);
    const at = y == null ? this.y : y;
    this.pdf.line(this.left + indent, at, this.right, at);
    return this;
  }

  gap(mm) {
    this.y += mm;
    return this;
  }

  /* --- text ----------------------------------------------------------- */

  /** Height `text` would occupy, without drawing it. */
  measure(text, style, width = PAGE.content, factor = 1.38) {
    const spec = this.font(style);
    const lines = this.pdf.splitTextToSize(winAnsi(text), width);
    return lines.length * leading(spec.size, factor);
  }

  /**
   * Flowed text. Returns the height consumed.
   *
   * jsPDF's baseline is the y it is handed, so every line is drawn one
   * leading below the cursor — without that, the first line of every
   * paragraph hangs above its own block and collides with whatever sits
   * over it.
   */
  text(content, style, {
    x = this.left,
    width = PAGE.content,
    colour = INK.ink,
    factor = 1.38,
    align = 'left',
    advance = true,
  } = {}) {
    const spec = this.font(style);
    this.pdf.setTextColor(colour);
    const lines = this.pdf.splitTextToSize(winAnsi(content), width);
    const step = leading(spec.size, factor);
    lines.forEach((line, index) => {
      const at = align === 'right' ? x + width : align === 'center' ? x + width / 2 : x;
      this.pdf.text(line, at, this.y + step * (index + 0.78), { align });
    });
    const height = lines.length * step;
    if (advance) this.y += height;
    return height;
  }

  /**
   * A single line at an exact baseline. For labels inside laid-out rows.
   *
   * Right- and centre-aligned text is placed by hand rather than through
   * jsPDF's `align`, because jsPDF aligns using its own untracked width
   * (see `trackedWidth`) — a right-aligned eyebrow was overhanging the
   * margin by one full space per character.
   */
  line(content, style, x, baseline, { colour = INK.ink, align = 'left', mono = false } = {}) {
    if (mono) this.mono(typeof style === 'number' ? style : TYPE[style].size);
    else this.font(style);
    this.pdf.setTextColor(colour);
    const safe = winAnsi(content);
    if (align === 'left') {
      this.pdf.text(safe, x, baseline);
      return this;
    }
    const width = this.trackedWidth(safe);
    this.pdf.text(safe, align === 'right' ? x - width : x - width / 2, baseline);
    return this;
  }

  /** An eyebrow with a hairline under it. The section marker of the document. */
  sectionLabel(label) {
    this.need(12);
    this.font('eyebrow');
    this.pdf.setTextColor(INK.faint);
    this.pdf.text(winAnsi(label).toUpperCase(), this.left, this.y + 2);
    this.y += 3.6;
    this.rule({ colour: INK.lineStrong, width: 0.35 });
    this.y += 5;
    return this;
  }

  heading(title, { style = 'h2', space = 3 } = {}) {
    this.need(this.measure(title, style) + space + 6);
    this.text(title, style, { colour: INK.ink });
    this.y += space;
    return this;
  }

  /* --- shapes --------------------------------------------------------- */

  panel(height, { fill = INK.raised, stroke = INK.line, radius = 1.6, x = this.left, width = PAGE.content } = {}) {
    this.pdf.setFillColor(fill);
    if (stroke) {
      this.pdf.setDrawColor(stroke);
      this.pdf.setLineWidth(0.2);
      this.pdf.roundedRect(x, this.y, width, height, radius, radius, 'FD');
    } else {
      this.pdf.roundedRect(x, this.y, width, height, radius, radius, 'F');
    }
    return this.y;
  }

  /**
   * A status chip: filled pill, word inside, its right edge at `right`.
   * Returns the width it took, so the caller can place what sits beside it.
   *
   * The pill is sized from `trackedWidth`, not `getTextWidth`. Under the
   * old measurement a six-letter word was reported 3.3mm narrower than it
   * drew, so the pill clipped its own text and the returned width put the
   * points column underneath the chip.
   */
  chip(label, { ink, fill }, right, baseline) {
    this.font('eyebrow');
    const safe = winAnsi(label);
    const textWidth = this.trackedWidth(safe);
    const w = textWidth + 4;
    const h = 4.2;
    const x = right - w;
    this.pdf.setFillColor(fill);
    this.pdf.roundedRect(x, baseline - h + 1.2, w, h, 1, 1, 'F');
    this.pdf.setTextColor(ink);
    this.pdf.text(safe, x + 2, baseline - 0.6);
    return w;
  }

  /** The numbered circle that opens every finding, matching the web rows. */
  numberDot(n, x, centreY, { ink = INK.muted, fill = INK.raised } = {}) {
    this.pdf.setFillColor(fill);
    this.pdf.circle(x, centreY, 2.5, 'F');
    this.font('micro');
    this.pdf.setTextColor(ink);
    this.pdf.text(String(n), x, centreY + 0.95, { align: 'center' });
    return this;
  }

  /**
   * The Boundry mark, drawn rather than rasterised.
   *
   * Same artwork as `Components/Layout/Logo.jsx` and `public/logo.svg` —
   * an asymmetric B with a small upper counter and a large lime lower
   * one — rebuilt out of jsPDF primitives. Vector, so it stays sharp at
   * any print resolution and costs nothing in file size. Embedding a PNG
   * would have been fewer lines and would have put a soft-edged bitmap at
   * the top of a document whose whole argument is precision.
   *
   * **Set reversed.** The masthead band is `--color-deep` and the mark's
   * body is `#0F0A0F`; drawn naturally it would vanish into the band and
   * leave the two counters floating. The body takes the light ink, the
   * upper counter is knocked out in the band's own colour, and the lime
   * is untouched — it is the one part of the mark a reader remembers.
   *
   * The SVG's semicircular arcs become cubic beziers at the usual
   * k = 0.5523 (the ratio that makes a bezier match a quarter circle to
   * within a thousandth of the radius).
   */
  logoMark(x, y, size, {
    body = INK.onDeep,
    counterTop = INK.deep,
    counterBottom = '#D4FF00',
  } = {}) {
    const pdf = this.pdf;
    /* The glyph is 60 units wide and 88 tall in the artwork's own
       coordinates, offset from its origin at (21, 11). `size` is its
       HEIGHT — the mark is taller than it is wide, and sizing it on width
       would leave it short beside the wordmark. */
    const k = size / 88;
    const px = (ux) => x + (ux - 21) * k;
    const py = (uy) => y + (uy - 11) * k;
    const C = 0.5523;

    /* Each entry is either [dx, dy] for a line or six values for a cubic
       bezier, all relative to the previous point, and all in artwork
       units — `lines()` scales them. */
    const stem = [
      [30, 0],                                            // top edge
      [18 * C, 0, 18, 18 - 18 * C, 18, 18],               // upper lobe, out
      [0, 18 * C, -(18 - 18 * C), 18, -18, 18],           // upper lobe, back
      [22 * C, 0, 22, 22 - 22 * C, 22, 22],               // lower lobe, out
      [0, 22 * C, -(22 - 22 * C), 22, -22, 22],           // lower lobe, back
      [-30, 0],                                           // bottom edge
    ];
    const upperCounter = [
      [10, 0],
      [6.5 * C, 0, 6.5, 6.5 - 6.5 * C, 6.5, 6.5],
      [0, 6.5 * C, -(6.5 - 6.5 * C), 6.5, -6.5, 6.5],
      [-10, 0],
    ];
    const lowerCounter = [
      [13, 0],
      [10.5 * C, 0, 10.5, 10.5 - 10.5 * C, 10.5, 10.5],
      [0, 10.5 * C, -(10.5 - 10.5 * C), 10.5, -10.5, 10.5],
      [-13, 0],
    ];

    /* Painted in order: the body first, then both counters over it.
       jsPDF has no even-odd fill for a compound path, so the counters are
       separate shapes laid on top rather than holes cut out of one. */
    pdf.setFillColor(body);
    pdf.lines(stem, px(25), py(15), [k, k], 'F', true);
    pdf.setFillColor(counterTop);
    pdf.lines(upperCounter, px(40), py(30), [k, k], 'F', true);
    pdf.setFillColor(counterBottom);
    pdf.lines(lowerCounter, px(40), py(59), [k, k], 'F', true);
    return this;
  }

  /* --- composed blocks ------------------------------------------------ */

  /**
   * A `label   value` row on a hairline, the way a schedule of cover is
   * set. `value` may be mono, which is how every machine-read string in
   * this document is distinguished from prose about it.
   */
  dataRow(label, value, {
    labelWidth = 46,
    mono = false,
    valueInk = INK.ink,
    rule = true,
    x = this.left,
    width = PAGE.content,
    style = 'caption',
  } = {}) {
    const spec = typeof style === 'string' ? TYPE[style] : style;
    const valueWidth = width - labelWidth;
    if (mono) this.mono(spec.size);
    else this.font(style);
    const lines = this.pdf.splitTextToSize(winAnsi(value), valueWidth);
    const step = leading(spec.size, 1.34);
    const height = Math.max(lines.length * step, step) + 1.6;
    this.need(height);

    const baseline = this.y + step * 0.78;
    this.line(label, 'caption', x, baseline, { colour: INK.faint });
    if (mono) this.mono(spec.size);
    else this.font(style);
    this.pdf.setTextColor(valueInk);
    lines.forEach((l, i) => this.pdf.text(l, x + labelWidth, baseline + step * i));
    this.y += height;
    if (rule) this.rule({ y: this.y - 0.8, colour: INK.line, indent: x - this.left });
    return height;
  }

  /**
   * A table with a ruled head and hairline rows.
   *
   * `columns` are `{ key, head, width, align, mono, ink }`. Rows break
   * across pages individually and the head is redrawn on each — a table
   * whose headings appear once, four pages back, is unreadable.
   */
  table(columns, rows, { headInk = INK.faint, zebra = false } = {}) {
    const drawHead = () => {
      this.need(9);
      this.font('eyebrow');
      this.pdf.setTextColor(headInk);
      let x = this.left;
      columns.forEach((col) => {
        const at = col.align === 'right' ? x + col.width : x;
        this.pdf.text(winAnsi(col.head).toUpperCase(), at, this.y + 2, { align: col.align || 'left' });
        x += col.width;
      });
      this.y += 3.4;
      this.rule({ colour: INK.lineStrong, width: 0.35 });
      this.y += 1.4;
    };

    drawHead();

    rows.forEach((row, index) => {
      // Measure the tallest cell before committing to a page.
      let height = 0;
      columns.forEach((col) => {
        const spec = col.mono ? { size: TYPE.caption.size } : TYPE[col.style || 'caption'];
        if (col.mono) this.mono(spec.size);
        else this.font(col.style || 'caption');
        const lines = this.pdf.splitTextToSize(winAnsi(row[col.key]), col.width - 3);
        height = Math.max(height, lines.length * leading(spec.size, 1.32));
      });
      height += 2.6;

      if (this.need(height + 2)) drawHead();

      if (zebra && index % 2 === 1) {
        this.pdf.setFillColor(INK.raised);
        this.pdf.rect(this.left, this.y - 0.6, PAGE.content, height, 'F');
      }

      let x = this.left;
      columns.forEach((col) => {
        const spec = col.mono ? { size: TYPE.caption.size } : TYPE[col.style || 'caption'];
        if (col.mono) this.mono(spec.size);
        else this.font(col.style || 'caption');
        this.pdf.setTextColor(
          typeof col.ink === 'function' ? col.ink(row) : col.ink || INK.ink,
        );
        const lines = this.pdf.splitTextToSize(winAnsi(row[col.key]), col.width - 3);
        const step = leading(spec.size, 1.32);
        const at = col.align === 'right' ? x + col.width : x;
        lines.forEach((l, i) =>
          this.pdf.text(l, at, this.y + step * (i + 0.78), { align: col.align || 'left' }),
        );
        x += col.width;
      });

      this.y += height;
      this.rule({ y: this.y - 1, colour: INK.line });
    });
    this.y += 2;
    return this;
  }

  /**
   * Run `block` only if it fits whole, otherwise start it on a new page.
   *
   * Measured by running the block against a throwaway document rather than
   * by predicting its height, so a block can grow without anyone having to
   * remember to update an estimate. The scratch document is discarded, so
   * nothing it draws reaches the output.
   */
  keepTogether(block, { maxHeight = null } = {}) {
    const scratch = new Doc(this.jsPDFClass, { subject: this.subject });
    scratch.y = PAGE.top;
    scratch.measuring = true;
    block(scratch);
    const height = Math.min(
      scratch.y - PAGE.top,
      maxHeight ?? this.bottom - PAGE.top,
    );
    this.need(height);
    block(this);
    return this;
  }

  /** Shorthand for the grade letter in its own colour. */
  gradeInk(grade) {
    return gradeInk(grade);
  }

  statusOf(status) {
    return statusOf(status);
  }

  pt(points) {
    return pt(points);
  }
}
