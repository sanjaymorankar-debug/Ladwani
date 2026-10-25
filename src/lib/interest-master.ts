/**
 * Default hobby / sport master list (Additional Details §10 and §9). Seeded
 * into the `interests` table by prisma/seeds/seed.ts; after that the table is
 * the source of truth and Admin edits it at /admin/interests. Every approved
 * entry gets one community interest group the first time somebody picks it.
 *
 * isChildSafe follows the brief ("studies, sports, arts, music"); Admin can
 * change it per entry. Members under 18 are only ever auto-joined to
 * child-safe groups.
 */
export interface InterestSeed {
  slug: string
  name: string
  category: string
  isSport?: boolean
  isChildSafe?: boolean
}

const CHILD_SAFE_CATEGORIES = new Set(['Arts', 'Music and stage', 'Reading and writing', 'Games'])

const raw: [string, [string, string, boolean?][]][] = [
  ['Arts', [
    ['drawing-painting', 'Drawing and painting'], ['rangoli', 'Rangoli'], ['mehndi', 'Mehndi'], ['craft', 'Craft'],
    ['photography', 'Photography'], ['videography', 'Videography'],
  ]],
  ['Music and stage', [
    ['singing', 'Singing'], ['bhajan-kirtan', 'Bhajan / kirtan'], ['instrument', 'Musical instrument'], ['dance', 'Dance'],
    ['drama', 'Drama'], ['anchoring', 'Anchoring'],
  ]],
  ['Reading and writing', [
    ['reading', 'Reading'], ['poetry', 'Poetry'], ['story-blog-writing', 'Story and blog writing'], ['public-speaking', 'Public speaking'],
  ]],
  ['Food', [['cooking', 'Cooking'], ['baking', 'Baking'], ['traditional-recipes', 'Traditional recipes']]],
  ['Outdoors', [
    ['trekking', 'Trekking'], ['cycling', 'Cycling'], ['running', 'Running'], ['travel', 'Travel'], ['pilgrimage', 'Pilgrimage (yatra)'],
    ['gardening', 'Gardening'], ['farming-methods', 'Farming methods'], ['bird-watching', 'Bird watching'],
  ]],
  ['Games', [
    ['cricket', 'Cricket', true], ['badminton', 'Badminton', true], ['chess', 'Chess', true], ['carrom', 'Carrom', true],
    ['kabaddi', 'Kabaddi', true], ['kho-kho', 'Kho-kho', true], ['football', 'Football', true], ['volleyball', 'Volleyball', true],
    ['table-tennis', 'Table tennis', true], ['athletics', 'Athletics', true], ['swimming', 'Swimming', true],
    ['wrestling', 'Wrestling', true], ['other-sports', 'Other sports', true],
  ]],
  ['Wellness', [['yoga', 'Yoga'], ['meditation', 'Meditation'], ['gym-fitness', 'Gym and fitness']]],
  ['Technology', [['coding', 'Coding'], ['gadgets', 'Gadgets'], ['ai', 'AI'], ['video-editing', 'Video editing'], ['gaming', 'Gaming']]],
  ['Money and business', [['share-market', 'Share market'], ['personal-finance', 'Personal finance'], ['start-ups', 'Start-ups']]],
  ['Home', [['interior-decoration', 'Interior decoration'], ['tailoring-embroidery', 'Tailoring and embroidery'], ['pets', 'Pets']]],
  ['Service', [['social-work', 'Social work'], ['teaching', 'Teaching'], ['blood-donation', 'Blood donation'], ['environment', 'Environment']]],
]

export const INTEREST_SEED: InterestSeed[] = raw.flatMap(([category, items]) =>
  items.map(([slug, name, isSport]) => ({
    slug, name, category, isSport: !!isSport, isChildSafe: CHILD_SAFE_CATEGORIES.has(category),
  }))
)

export const INTEREST_CATEGORIES = raw.map(([c]) => c)

/** Normalises a free-text name for duplicate detection and slugs. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
