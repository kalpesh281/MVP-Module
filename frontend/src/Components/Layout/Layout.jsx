import Header from './Header';
import Footer from './Footer';

/** The page frame. Deliberately thin: there is no navigation, no account
 *  menu and no signup prompt, because Tier 0 asks the user for nothing
 *  before showing them their result. docs/education-layer.md */
export default function Layout({ children }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <Header />
      {/* px-4 is the 320px floor: 16px of gutter on the narrowest phone we
          support, with no horizontal scroll. Gate 1 §1.5 */}
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
        {children}
      </main>
      <Footer />
    </div>
  );
}
