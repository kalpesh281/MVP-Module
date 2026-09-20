import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { Clock, Eye, Lock } from 'lucide-react';

import DomainInput from '../Components/Scan/DomainInput';
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
    Icon: Clock,
    title: 'Under thirty seconds',
    body: 'Seven checks run at once. You watch each one land rather than waiting on a blank screen.',
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const recent = useSelector(selectRecentDomains);

  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="py-8 sm:py-16">
      <motion.p
        variants={fadeUp}
        className="text-sm font-medium uppercase tracking-widest text-accent"
      >
        Cyber liability · India
      </motion.p>

      <motion.h1
        variants={fadeUp}
        className="mt-3 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl"
      >
        See your company the way an{' '}
        <Term id="underwriter">underwriter</Term> does.
      </motion.h1>

      <motion.p variants={fadeUp} className="mt-4 max-w-xl text-lg leading-relaxed text-ink-muted">
        Enter your domain. You get a security grade, an estimated{' '}
        <Term id="premium">premium</Term> for ₹5 Cr of cover, and the specific
        things worth fixing before you apply.
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

      <motion.div variants={fadeUp} className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
        {ASSURANCES.map(({ Icon, title, body }) => (
          <div key={title} className="bg-surface p-5">
            <Icon className="size-5 text-accent" aria-hidden="true" />
            <h2 className="mt-3 font-medium leading-snug">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{body}</p>
          </div>
        ))}
      </motion.div>

      <motion.section variants={fadeUp} className="mt-12">
        <h2 className="text-lg font-medium">Why a grade, and not a quote</h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-ink-muted">
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
