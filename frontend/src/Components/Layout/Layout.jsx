import Header from './Header';
import Footer from './Footer';

/** The page frame. Deliberately thin: there is no navigation, no account
 *  menu and no signup prompt, because Tier 0 asks the user for nothing
 *  before showing them their result. docs/education-layer.md */
export default function Layout({ children }) {
  return (
    <div className="rails relative flex min-h-dvh flex-col bg-canvas text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <Header />
      {/* `shell` is the one measure the whole page is set to — header,
          content and footer all share it, so the logo, the first word of
          the report and the first word of the footer sit on one vertical
          line.

          They did not before: the header and footer ran to the window
          edges while the content sat in a centred column, which read as a
          box dropped onto a page rather than as a page. With the blueprint
          rails drawn at the column's edges it was worse — the only two
          elements crossing them were the two that frame everything else.

          px-4 is the 320px floor: 16px of gutter on the narrowest phone we
          support, with no horizontal scroll. Gate 1 §1.5 */}
      <main id="main" className="shell relative z-10 flex-1 py-8 sm:py-12">
        {children}
      </main>
      <Footer />
    </div>
  );
}
