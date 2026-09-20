import InfoTip from '../Extra/InfoTip';
import Term from '../Extra/Term';

/** What the classifier worked out about the company.
 *
 *  Shown because it is the basis of the revenue band, and therefore of
 *  the premium. A user who disagrees with it should be able to see that
 *  we got it wrong rather than wondering where the number came from. */
export default function ProfileCard({ profile }) {
  if (!profile) return null;

  return (
    <div className="rounded-2xl border border-line bg-raised p-5">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-faint">
        What we understand about you
        <InfoTip label="Why this matters to the price">
          Your size band selects the premium table, so if this is wrong the estimate
          is wrong with it. We infer it from your own website and prefer the smaller
          band when the evidence is thin — quoting low and correcting upward is
          recoverable, quoting high is not.
        </InfoTip>
      </p>
      <p className="mt-2 font-medium">{profile.company_name}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">
        {profile.what_they_do}
      </p>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-faint">
        <span>{profile.business_model?.replaceAll('_', ' ')}</span>
        <span aria-hidden="true">·</span>
        <span>{profile.estimated_size_band} people</span>
        {profile.dpdp_act_applies && (
          <>
            <span aria-hidden="true">·</span>
            <Term id="dpdp">DPDP Act</Term> applies
          </>
        )}
      </p>
    </div>
  );
}
