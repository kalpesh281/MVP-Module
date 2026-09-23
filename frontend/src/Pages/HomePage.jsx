import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { Activity, Eye, Lock } from 'lucide-react';

import DomainInput from '../Components/Scan/DomainInput';
import HeroReport from '../Components/Home/HeroReport';
import RevealText from '../Components/Extra/RevealText';
import Term from '../Components/Extra/Term';
import { selectRecentDomains } from '../Features/uiSlice';
import { fadeUp, stagger } from '../utils/motion';

const ASSURANCES = [
  {
    Icon: Eye,
    title: 'We only read what is already public',
    body: 'DNS records, your certificate, your response headers, public certificate logs. Nothing is probed or logged into.',
  },
  {
    Icon: Lock,
    title: 'Nothing is asked of you first',
    body: 'No sign-up, no email, no call. You get the report, then decide whether you want a closer number.',
  },
  {
    // No duration claimed. A scan takes as long as the slowest public
    // source answers, and a number here is a promise we would be breaking
    // on the first slow certificate log — on the one page whose whole job
    // is to be checkable, thirty seconds later, by the reader.
    Icon: Activity,
    title: 'You watch it happen',
    body: 'Seven checks run at once, and each result appears the moment it lands — not a spinner and then an answer.',
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const recent = useSelector(selectRecentDomains);

  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="py-8 sm:py-14">
      {/* Two columns from `lg`. Below that the specimen would push the field
          below the fold, and the field is the page. */}
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
      <div>
      <motion.p
        variants={fadeUp}
        className="text-eyebrow uppercase text-accent"
      >
        Cyber liability · India
      </motion.p>

      {/* Word-by-word reveal with a resolving blur. RevealText takes the
          children rather than a string so the glossary term survives. */}
      <RevealText
        as="h1"
        delay={0.12}
        // Set solid. Display type at line-height 1 with tight negative
        // tracking is the whole of the "modern institutional" look — every
        // platform measured in this category does it, without exception.
        className="mt-4 max-w-2xl font-display text-display text-balance"
      >
        {'See your company the way an'}
        <Term id="underwriter">underwriter</Term>
        {'does.'}
      </RevealText>

      <motion.p variants={fadeUp} className="mt-5 max-w-xl text-lg leading-relaxed text-ink-muted">
        {/* No cover amount promised here. It follows the revenue band —
            ₹1 Cr for the smallest, ₹25 Cr for the largest — so naming one
            on a page that has not met the company yet is a figure most
            readers would not go on to see. */}
        Enter your domain. You get a security grade, an estimated{' '}
        <Term id="premium">premium</Term> for cover at your size, and the
        specific things worth fixing before you apply.
      </motion.p>

      <motion.div variants={fadeUp} className="mt-8">
        <DomainInput autoFocus onSubmit={(domain) => navigate(`/scan/${domain}`)} />
      </motion.div>

      {recent.length > 0 && (
        <motion.div variants={fadeUp} className="mt-6">
          <p className="text-sm text-ink-faint">Recently checked</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {recent.map((domain) => (
              <button
                key={domain}
                type="button"
                onClick={() => navigate(`/scan/${domain}`)}
                className="rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-sm
                           transition-colors hover:border-line-strong hover:bg-raised"
              >
                {domain}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      </div>

        <motion.div variants={fadeUp} className="hidden justify-self-end lg:block">
          <HeroReport />
        </motion.div>
      </div>

      {/* Hairline dividers rather than nested boxes. Both Corgi and Mitigata
          build their stat strips this way, and it is the cheapest
          "underwriter's document" cue there is — a box around every item
          reads as a dashboard, a rule between them reads as a schedule. */}
      <motion.div
        variants={fadeUp}
        className="mt-20 grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-3"
        style={{ boxShadow: 'var(--shadow-e1)' }}
      >
        {ASSURANCES.map(({ Icon, title, body }) => (
          <div key={title} className="bg-surface p-6">
            <Icon className="size-5 text-accent" aria-hidden="true" />
            <h2 className="mt-4 font-display text-h3">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
          </div>
        ))}
      </motion.div>

      {/* The dark band. Every platform in this category breaks a long light
          page with one inset dark panel — At-Bay, Corgi (#2c2c2c rounded
          rects), Mitigata (#0e2a1f). It is the section that carries the
          argument, so it is the section that stops looking like the rest. */}
      <motion.section
        variants={fadeUp}
        className="mt-14 rounded-panel bg-deep px-7 py-9 text-on-deep sm:px-10 sm:py-11"
        style={{ boxShadow: 'var(--shadow-e2)' }}
      >
        <p className="text-eyebrow uppercase text-on-deep-muted">Methodology</p>
        <h2 className="mt-3 max-w-2xl font-display text-h2 text-balance">
          Why a grade, and not a quote
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-on-deep-muted">
          An insurer prices <Term id="cyber_liability">cyber liability</Term> partly
          on what they can verify about you from outside. We do the same, against a
          published set of scoring rules — every point traces back to one, so the
          same domain scanned twice gives the same grade and any finding can be
          challenged. What we cannot see is your revenue, your internal controls and
          your claims history, which is why this is an estimate rather than a{' '}
          <Term id="proposal_form">proposal form</Term>.
        </p>
      </motion.section>
    </motion.div>
  );
}
