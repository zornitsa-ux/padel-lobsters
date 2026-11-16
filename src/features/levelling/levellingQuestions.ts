// Answer codes are CONTRACTS C-1; the database CHECKs reject anything else.
// Wording signed off by the owner; keep each answer one concrete, checkable thing.

export const QUESTION_KEYS = [
  'years_playing',
  'frequency',
  'lessons',
  'racket_sports',
  'walls',
] as const

export type QuestionKey = (typeof QUESTION_KEYS)[number]

interface Question {
  key: QuestionKey
  title: string
  hint?: string
  options: readonly { code: string; label: string }[]
}

export const QUESTIONS: readonly Question[] = [
  {
    key: 'years_playing',
    title: 'How long have you been playing padel?',
    options: [
      { code: 'few_times', label: 'Not yet, or only a few times' },
      { code: 'under_1y', label: 'Less than 1 year' },
      { code: '1_to_3y', label: 'Between 1 year and 3 years' },
      { code: 'over_3y', label: 'More than 3 years' },
    ],
  },
  {
    key: 'frequency',
    title: 'How often do you play?',
    options: [
      { code: 'monthly_or_less', label: 'Once a month or less' },
      { code: 'few_per_month', label: 'A few times a month' },
      { code: 'weekly_1_2', label: 'Once or twice a week' },
      { code: 'weekly_3_plus', label: 'Three or more times per week' },
    ],
  },
  {
    key: 'lessons',
    title: 'Have you had padel lessons or coaching?',
    options: [
      { code: 'none', label: 'No' },
      { code: '1_to_10', label: 'Some (1–10 lessons)' },
      { code: 'over_10', label: 'More than 10 lessons' },
    ],
  },
  {
    key: 'racket_sports',
    title: 'Have you played tennis, squash or another racket sport?',
    options: [
      { code: 'none', label: 'No' },
      { code: 'casual', label: 'Casually' },
      { code: 'regular', label: 'Regularly, for a year or more' },
      { code: 'competitive', label: 'Competitively (club, league or tournaments)' },
    ],
  },
  {
    key: 'walls',
    title: 'How do you handle balls off the walls?',
    hint: 'Pick the one that’s true most of the time.',
    options: [
      { code: 'lets_go', label: 'I usually let them go, or I’m just starting to learn' },
      { code: 'slow_back_wall', label: 'I can return a slow ball off the back wall' },
      {
        code: 'back_wall_not_corners',
        label: 'I’m comfortable off the back wall, but corners are hard',
      },
      {
        code: 'corners',
        label: 'I’m comfortable with most balls off the walls, corners included',
      },
    ],
  },
]

/** The five questions plus the Playtomic step. Copy says "6 questions". */
export const TOTAL_STEPS = QUESTIONS.length + 1
