import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, ChevronDown } from 'lucide-react';
import { CHECK_BLURBS, CHECK_DETAIL } from '../../data/gradeMeta';
import { EASE, expand } from '../../utils/motion';

/**
 * One check, as a row of a schedule.
 *
 * **Why the whole row opens rather than a small ⓘ beside the label.** The
 * detail behind each check — what was actually read, why an underwriter
 * cares, what it is worth — is the most persuasive writing in the
 * product, and it was hidden behind a 14px icon that most readers never
 * discovered. A row that opens is a row people open.
 *
 * **Why it reads across the full width.** Seven short labels in a single
 * narrow column left most of each row empty on a wide screen. The layout
 * is now the one every risk product converges on: a coloured severity
 * edge, the finding on the left, and the verdict and its point value
 * right-aligned in their own columns. Right-aligned tabular figures in a
 * column are what make a list read as a schedule rather than as a feed.
 *
 * The status is never carried by colour alone — every row has an icon, a
 * word, and a screen-reader label. That is an accessibility requirement
 * and it is also why it reads as instrumentation.
 */

const ICONS = {
  pass: {
    tone: 'text-pass',
    bg: 'bg-pass/10',
    ring: 'border-pass/25',
    chip: 'border-pass/30 bg-pass-bg text-pass',
    label: 'Pass',
    sr: 'Passed',
  },
  warn: {
    tone: 'text-warn',
    bg: 'bg-warn/10',
    ring: 'border-warn/30',
    chip: 'border-warn/30 bg-warn-bg text-warn',
    label: 'Attention',
    sr: 'Needs attention',
  },
  fail: {
    tone: 'text-fail',
    bg: 'bg-fail/10',
    ring: 'border-fail/30',
    chip: 'border-fail/30 bg-fail-bg text-fail',
    label: 'Failed',
    sr: 'Failed',
  },
  inconclusive: {
    tone: 'text-inconclusive',
    bg: 'bg-inconclusive/10',
    ring: 'border-line-strong',
    chip: 'border-line-strong bg-raised text-ink-faint',
    label: 'Unknown',
    sr: 'Could not check',
  },
};

export default function CheckRow({ check, index }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const pending = check.status === 'pending';
  const { tone, bg, ring, chip, label, sr } = ICONS[check.status] ?? ICONS.inconclusive;
  const detail = CHECK_DETAIL[check.id];
  // Exactly which URL the observation came from. Without it, "Missing CSP"
  // reads as a claim about a company's whole estate rather than about the
  // one page we requested — which is all we ever looked at.
  const source = check.evidence?.final_url;

  return (
    <li className="relative">
      <button
        type="button"
        disabled={pending || !detail}
        aria-expanded={detail ? open : undefined}
        aria-controls={detail ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors
                   hover:bg-raised/60 disabled:cursor-default disabled:hover:bg-transparent"
      >
        {/* The position in the run, not a tick. Seven identical green
            circles down the left edge carried no information the word on
            the right was not already carrying, and numbering them turns a
            feed into a numbered schedule — which is the register this page
            is going for.

            The tint still encodes the status, so the column scans at a
            glance; the status is never colour alone, because every row also
            carries the word and a screen-reader label. */}
        <motion.span
          key={check.status}
          initial={pending ? false : { scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.28, ease: EASE }}
          className={`flex size-7 shrink-0 items-center justify-center rounded-full border
                      text-caption font-medium tabular-nums ${
                        pending ? 'border-line bg-raised text-ink-faint' : `${bg} ${ring} ${tone}`
                      }`}
        >
          {pending ? (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          ) : (
            index
          )}
        </motion.span>

        <span className="min-w-0 flex-1">
          <span className={`block font-medium ${pending ? 'text-ink-muted' : 'text-ink'}`}>
            {check.label}
            <span className="sr-only">. {pending ? 'Checking' : sr}.</span>
          </span>
          <motion.span
            key={check.detail || 'pending'}
            initial={pending ? false : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="mt-1 block text-sm leading-relaxed text-ink-muted"
          >
            {pending ? CHECK_BLURBS[check.id] : check.detail}
          </motion.span>
        </span>

        {/* The three right-hand columns. Hidden on a phone, where there is
            no width for them and the icon already carries the status. */}
        {!pending && (
          <span className="flex shrink-0 items-center gap-5">
            {/* Shown at every width. Below `sm` the number in the circle no
                longer says pass or fail, so the word has to. */}
            <span className={`rounded-full border px-2.5 py-1 text-eyebrow uppercase ${chip}`}>
              {label}
            </span>
            {detail && (
              <span className="hidden w-16 text-right text-caption tabular-nums text-ink-faint sm:block">
                {detail.points} pts
              </span>
            )}
          </span>
        )}

        {detail && !pending && (
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="shrink-0 text-ink-faint"
          >
            <ChevronDown className="size-4" aria-hidden="true" />
          </motion.span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && detail && (
          <motion.div
            id={panelId}
            variants={expand}
            initial="hidden"
            animate="show"
            exit="exit"
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-line bg-canvas px-5 py-4 pl-16 text-sm leading-relaxed text-ink-muted">
              <p>{detail.what}</p>
              <p>{detail.why}</p>
              {source ? (
                <p className="text-caption">
                  <span className="text-ink-faint">Read from </span>
                  <code className="break-all font-mono text-ink-muted">{source}</code>
                  <span className="text-ink-faint">
                    {' '}— this one address, not your whole estate.
                  </span>
                </p>
              ) : null}
              <p className="border-t border-line pt-3 text-caption text-ink-faint">
                Worth up to{' '}
                <span className="tabular-nums font-medium text-ink-muted">
                  {detail.points}
                </span>{' '}
                of the 100 points. A clean result deducts nothing.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
