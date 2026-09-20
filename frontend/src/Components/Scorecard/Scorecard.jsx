import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { selectSelectedIds } from '../../Features/simulatorSlice';
import { simulate } from '../../utils/simulate';
import { fadeUp, stagger, EASE } from '../../utils/motion';

import CheckFeed from '../Scan/CheckFeed';
import GradeGauge from './GradeGauge';
import SummaryStrip from './SummaryStrip';
import PremiumCard from './PremiumCard';
import FixList from './FixList';
import Strengths from './Strengths';
import ProfileCard from './ProfileCard';
import CachedNotice from './CachedNotice';
import CtaCard from './CtaCard';
import ReportNav from './ReportNav';
import ResultRail from './ResultRail';

/**
 * The report, in three steps.
 *
 * It used to be one column about two and a half screens tall, and a
 * founder had to scroll past the whole thing to reach the premium, with
 * the fix simulator at the very bottom where the least patient reader
 * never arrived.
 *
 * The order is evidence first: what we looked at, then the grade and the
 * premium that follow from it, then what to do about them. The findings
 * arrive before the verdict, so the letter reads as a consequence of
 * things the reader has already seen rather than a judgement handed down.
 *
 * Grade and premium share a step deliberately. The premium is derived
 * from the grade, and on separate steps the price arrived with its reason
 * one page behind it.
 *
 * Paging it gives each question a screen of its own and makes the length
 * honest: three steps, stated up front, instead of an unknown amount of
 * scrolling. Every step is reachable from the nav at any time — this is a
 * report, not a wizard, and someone who wants the price first should have
 * it.
 *
 * The grade and premium ride along in `ResultRail` on every step, which is
 * what makes the split safe: ticking a fix on the last step still moves
 * both numbers in view, with no request in flight. Gate 1 §1.5
 */
export default function Scorecard({
  result,
  profile,
  cached,
  cacheAgeSeconds,
  onRefresh,
  domain,
}) {
  const selectedIds = useSelector(selectSelectedIds);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const simulated = useMemo(() => simulate(result, selectedSet), [result, selectedSet]);
  const changed = simulated.selected > 0;
  const reduced = useReducedMotion();

  const [step, setStep] = useState(0);
  const topRef = useRef(null);
  const firstRender = useRef(true);

  // Move the reader to the top of the new step. Not on first paint: the
  // page has only just resolved from a scan and yanking it would undo
  // whatever the reader was already looking at.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    topRef.current?.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'start',
    });
  }, [step, reduced]);

  const steps = [
    {
      id: 'checks',
      label: 'The checks',
      // The evidence behind the grade. It keeps its own step rather than
      // being dropped once the number lands — a grade with no visible
      // working is the thing this whole product is built not to be.
      render: () => (
        <motion.div variants={fadeUp}>
          <CheckFeed domain={domain} />
        </motion.div>
      ),
    },
    {
      id: 'result',
      label: 'Your result',
      render: () => (
        <>
          {result.headline && (
            <motion.p variants={fadeUp} className="text-xl leading-relaxed tracking-tight">
              {result.headline}
            </motion.p>
          )}
          <motion.div variants={fadeUp}>
            <ProfileCard profile={profile} />
          </motion.div>
          <motion.div variants={fadeUp}>
            <GradeGauge
              grade={simulated.grade}
              score={simulated.score}
              availablePoints={result.available_points}
              suppressed={result.grade_suppressed && !changed}
              changed={changed}
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <SummaryStrip result={result} simulated={simulated} />
          </motion.div>
          {/* The premium sits with the grade that produced it rather than
              on a step of its own. Split apart, the price arrived without
              its reason attached and the reader had to page back to see
              what it followed from. */}
          <motion.div variants={fadeUp}>
            <PremiumCard
              premium={simulated.premium}
              baseline={result.premium}
              saving={simulated.saving}
              bandLabel={result.premium_table?.revenue_band_label}
              coverLabel={result.premium_table?.limit_label}
              rateVersion={result.rate_version}
              grade={simulated.grade}
            />
          </motion.div>
        </>
      ),
    },
    {
      id: 'next',
      label: 'What to do',
      render: () => (
        <>
          <motion.div variants={fadeUp}>
            <FixList fixes={result.fixes || []} simulated={simulated} />
          </motion.div>
          <motion.div variants={fadeUp}>
            <Strengths items={result.strengths} />
          </motion.div>
          <motion.div variants={fadeUp}>
            <CtaCard scanId={result.scan_id} />
          </motion.div>
        </>
      ),
    },
  ];

  const last = steps.length - 1;
  const go = (next) => setStep(Math.min(last, Math.max(0, next)));

  return (
    <div className="space-y-5" ref={topRef}>
      {cached && <CachedNotice ageSeconds={cacheAgeSeconds} onRefresh={onRefresh} />}

      <ResultRail
        grade={simulated.grade}
        score={simulated.score}
        premium={simulated.premium}
        changed={changed}
        suppressed={result.grade_suppressed && !changed}
      />

      <ReportNav steps={steps} current={step} onSelect={go} />

      {/* mode="wait" so the outgoing step is gone before the next arrives.
          Cross-fading two columns of different heights makes the page jump
          under the reader's cursor. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={steps[step].id}
          variants={stagger(0.07)}
          initial={reduced ? false : 'hidden'}
          animate="show"
          exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.24, ease: EASE }}
          className="space-y-5"
        >
          {steps[step].render()}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <button
          type="button"
          onClick={() => go(step - 1)}
          disabled={step === 0}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium
                     text-ink-muted transition-colors hover:text-ink
                     disabled:pointer-events-none disabled:opacity-0"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {steps[Math.max(0, step - 1)].label}
        </button>

        <span className="text-xs tabular-nums text-ink-faint">
          {step + 1} of {steps.length}
        </span>

        <button
          type="button"
          onClick={() => go(step + 1)}
          disabled={step === last}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm
                     font-medium text-white transition-colors hover:bg-accent-hover
                     disabled:pointer-events-none disabled:opacity-0"
        >
          {steps[Math.min(last, step + 1)].label}
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      <p className="pt-1 text-xs text-ink-faint">
        Scoring rules {result.rubric_version} · rate card {result.rate_version}.
        Every point traces to a published rule, so this domain scanned again
        produces the same grade.
      </p>
    </div>
  );
}
