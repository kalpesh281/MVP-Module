/**
 * Insurance terms, each with a one-sentence plain-language gloss.
 *
 * The guidance across insurance UX writing is consistent on this: do not
 * strip the real vocabulary out, and do not leave it unexplained either.
 * A founder who reads "sum insured" here and meets it again on a broker's
 * proposal form has learned something. A founder who only ever reads
 * "cover amount" has to learn it later, from someone selling to them.
 *
 * So the term stays, and the definition is one hover away. Every gloss is
 * one sentence, active voice, no second term inside it.
 * docs/education-layer.md
 */
export const GLOSSARY = {
  premium: {
    term: 'premium',
    definition: 'What you pay the insurer each year to hold the policy.',
  },
  sum_insured: {
    term: 'sum insured',
    definition:
      'The most the insurer will pay out in a year, across all claims. Also called the limit of indemnity.',
  },
  underwriter: {
    term: 'underwriter',
    definition:
      'The person at the insurer who decides whether to offer you cover, and at what price.',
  },
  proposal_form: {
    term: 'proposal form',
    definition:
      'The application an insurer asks you to fill in. Answering it wrongly can void a claim later.',
  },
  excess: {
    term: 'excess',
    definition:
      'The first slice of any claim you pay yourself before the insurer pays anything.',
  },
  cyber_liability: {
    term: 'cyber liability',
    definition:
      'Cover for losses caused by a breach of your systems — your own costs, and what you owe others.',
  },
  first_party: {
    term: 'first-party loss',
    definition: 'Money the incident costs you directly: recovery, ransom, lost income.',
  },
  third_party: {
    term: 'third-party liability',
    definition: 'What you owe other people — customers, partners — because of the incident.',
  },
  risk_posture: {
    term: 'risk posture',
    definition:
      'How exposed you look to an assessor, based on what they can observe about your systems.',
  },
  material_fact: {
    term: 'material fact',
    definition:
      'Anything an insurer would want to know before quoting. Leaving one out can void the policy.',
  },
  dpdp: {
    term: 'DPDP Act',
    definition:
      "India's data protection law. It applies to you if you hold personal data about people in India.",
  },
};
