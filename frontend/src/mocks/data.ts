// Dummy data for development. Replaced by the real backend once VITE_USE_MOCKS=false.
import type { Article, Country, Section } from '../api/types'

const CODES = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ
BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE
EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR
HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS
LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL
NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI
SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY
UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`
  .split(/\s+/)
  .filter(Boolean)

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

export const COUNTRIES: Country[] = CODES.map((code) => ({
  code,
  name: regionNames.of(code) ?? code,
})).sort((a, b) => a.name.localeCompare(b.name))

const countryName = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code

/** Countries the demo always gives full coverage. */
const WELL_COVERED = new Set(['US', 'GB', 'IN', 'DE', 'FR', 'JP', 'CA', 'AU', 'BR', 'ZA', 'NG', 'KE'])

/** Requests for this country return a 500, to demo the error view. */
export const FAILING_COUNTRY = 'AQ'

const HEADLINES: Record<Section, string[]> = {
  nature: [
    'Record bird migration counted across {c} wetlands',
    'New marine reserve announced off the coast of {c}',
    'Drought eases as seasonal rains return to {c}',
    'Scientists in {c} track rare wildcat on camera traps',
    'Reforestation drive in {c} passes one million trees',
    'Heatwave warning issued for much of {c}',
    'River clean-up in {c} brings fish back upstream',
    'Coral survey finds signs of recovery near {c}',
    'Early spring bloom surprises botanists in {c}',
    'Wildfire season forecast released for {c}',
    'Volunteers map invasive plants along {c} trails',
    'Air quality in {c} cities improves for third year',
  ],
  society: [
    '{c} announces new plan to expand public libraries',
    'Teachers and ministry in {c} reach pay agreement',
    'Census shows young people moving to cities in {c}',
    'Local elections draw record turnout across {c}',
    'Housing costs top concerns in new {c} survey',
    'Free school meals scheme widened in {c}',
    'Public transport fares frozen for another year in {c}',
    'Festival season opens with street parades across {c}',
    'Hospitals in {c} trial shorter waiting lists',
    'Volunteer numbers rise at {c} community centres',
    'New pension rules come into force in {c}',
    'Museum attendance in {c} back above pre-pandemic levels',
  ],
  technology: [
    'Start-ups in {c} raise record funding this quarter',
    '{c} rolls out faster broadband to rural towns',
    'Government in {c} publishes draft rules on AI use',
    'Electric vehicle sales climb sharply in {c}',
    'Data centre investment planned for {c}',
    'Banks in {c} move to instant payments by default',
    'Universities in {c} launch joint chip research lab',
    'Solar capacity in {c} hits new milestone',
    'Cyber-security agency in {c} warns of phishing wave',
    'Satellite internet trial connects remote {c} villages',
    'Developers in {c} host country’s largest hackathon',
    'Digital ID pilot expands to more regions of {c}',
  ],
}

const SUMMARIES = [
  'Officials said the change would take effect over the coming months, with a review planned for next year.',
  'Experts welcomed the news but cautioned that more data is needed before drawing firm conclusions.',
  'The announcement follows months of consultation with local groups, businesses and researchers.',
  'Figures released on Tuesday show the trend has continued for a third consecutive period.',
  'Critics argue the plan does not go far enough, while supporters call it a practical first step.',
]

const SOURCES = [
  'Global Wire',
  'The Daily Ledger',
  'Morning Courier',
  'Planet Report',
  'City Herald',
  'Signal News',
  'The Observer Post',
]

/** Small deterministic PRNG so each country/section always gets the same articles. */
function seeded(seedText: string) {
  let h = 2166136261
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

function articleCount(code: string, section: Section, rand: () => number): number {
  if (WELL_COVERED.has(code)) return 8 + Math.floor(rand() * 5) // 8–12
  const roll = seeded(`${code}-${section}-coverage`)()
  if (roll < 0.15) return 0 // empty
  if (roll < 0.45) return 1 + Math.floor(rand() * 4) // thin: 1–4
  return 5 + Math.floor(rand() * 6) // 5–10
}

export function makeArticles(code: string, section: Section, now = Date.now()): Article[] {
  const rand = seeded(`${code}-${section}`)
  const count = articleCount(code, section, rand)
  const name = countryName(code)
  const pool = [...HEADLINES[section]].sort(() => rand() - 0.5)

  let minutesAgo = 5 + Math.floor(rand() * 30)
  return Array.from({ length: count }, (_, i) => {
    const article: Article = {
      id: `${code}-${section}-${i}`.toLowerCase(),
      title: pool[i % pool.length].replace('{c}', name),
      source: SOURCES[Math.floor(rand() * SOURCES.length)],
      url: `https://example.com/news/${code.toLowerCase()}/${section}/${i}`,
      publishedAt: new Date(now - minutesAgo * 60_000).toISOString(),
    }
    if (rand() > 0.25) article.summary = SUMMARIES[Math.floor(rand() * SUMMARIES.length)]
    // Stock photos for about two thirds of stories, so both card styles show up in the demo.
    if (rand() > 0.33) article.imageUrl = `https://picsum.photos/seed/${article.id}/480/320`
    minutesAgo += 20 + Math.floor(rand() * 180)
    return article
  })
}
