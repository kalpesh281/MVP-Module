/**
 * A deliberate dead end.
 *
 * jsPDF carries optional integrations — html2canvas for `.html()`, canvg
 * for SVG, dompurify for the sanitising both of those need. `utils/pdf`
 * uses none of them: every rule, panel and glyph in the report is drawn
 * through jsPDF's own primitives. But jsPDF's `import()` calls are static
 * enough for Rollup to follow, and following them costs 350KB of a bundle
 * no code path can reach.
 *
 * `vite.config.js` aliases all three here. If a future change does call
 * `.html()`, it will fail loudly against this rather than silently
 * shipping the weight again.
 */
export default undefined;
