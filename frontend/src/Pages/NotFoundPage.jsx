import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="py-16">
      <h1 className="text-2xl font-medium">That page doesn&apos;t exist.</h1>
      <p className="mt-2 text-ink-muted">
        Check the address, or start a new scan.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover"
      >
        Check a domain
      </Link>
    </div>
  );
}
