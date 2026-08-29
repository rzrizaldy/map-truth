// The demo's whole claim is that the image is grounded in a real place. If the
// prompt names a place, the map has to be able to go there — otherwise "Jakarta
// map overlay" happily renders New York and nothing is grounded to the ask.

// Common shorthands people actually type. Nominatim resolves most full names on
// its own; these are the ones it would miss or resolve somewhere unhelpful.
const ALIASES: Record<string, string> = {
  nyc: 'New York City',
  nj: 'New Jersey',
  ny: 'New York',
  la: 'Los Angeles',
  sf: 'San Francisco',
  dc: 'Washington, D.C.',
  uk: 'United Kingdom',
  usa: 'United States',
  us: 'United States',
  uae: 'United Arab Emirates',
  jkt: 'Jakarta',
  sg: 'Singapore',
  kl: 'Kuala Lumpur',
  hk: 'Hong Kong',
  bcn: 'Barcelona',
  cdmx: 'Mexico City',
}

// Words that get capitalised in art briefs but are never places.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'map', 'maps', 'overlay', 'poster', 'print', 'city', 'region', 'area',
  'based', 'on', 'vibes', 'vibe', 'with', 'and', 'or', 'of', 'in', 'at', 'for', 'from', 'to',
  'hypothetical', 'imaginary', 'fictional', 'style', 'styled', 'editorial', 'bold', 'minimal',
  'create', 'make', 'draw', 'generate', 'render', 'show', 'i', 'want', 'please', 'like',
  'black', 'white', 'cream', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'grey', 'gray',
  'gpt', 'image', 'ai', 'if', 'it', 'had', 'has', 'lived', 'here', 'were', 'was', 'be',
  // Prompts are not always in English. These are the words for map / city /
  // street / building that would otherwise read as the name of a place.
  'peta', 'kota', 'jalan', 'gedung', 'daerah', 'wisata', 'demo', 'aksi',
  'mapa', 'mappa', 'carte', 'karte', 'kaart', 'kart', 'harita', 'harta',
  'ciudad', 'ville', 'stadt', 'citta', 'cidade', 'stad',
  'plano', 'plan', 'affiche', 'cartel', 'plakat',
  // The vocabulary this product's prompts are actually made of. These are
  // nouns, not destinations — "Protest safety map — DPR Jakarta" is about DPR.
  'protest', 'rally', 'march', 'demonstration', 'safety', 'secure', 'security',
  'evacuation', 'evacuate', 'emergency', 'disaster', 'flood', 'earthquake', 'fire',
  'route', 'routes', 'zone', 'zones', 'area', 'areas', 'district', 'districts',
  'gathering', 'assembly', 'meeting', 'point', 'points', 'post', 'posts',
  'medical', 'aid', 'shelter', 'shelters', 'hospital', 'clinic',
  'delivery', 'logistics', 'coverage', 'service', 'venue', 'event', 'festival',
  'guide', 'infographic', 'diagram', 'layout', 'legend', 'key', 'title',
  'show', 'showing', 'include', 'including', 'mark', 'marking', 'label', 'labels',
  // Indonesian imperatives and connectors, which a sentence break capitalises.
  'tandai', 'tunjukkan', 'tampilkan', 'buat', 'buatkan', 'gambar', 'sertakan',
  'titik', 'kumpul', 'pos', 'medis', 'rute', 'lokasi', 'dengan', 'serta',
])

// Style words that look exactly like places. "A 1970s Swiss travel poster of
// Kyoto" is about Kyoto; offering to fly the map to Switzerland is wrong.
const STYLE_WORDS = new Set([
  'swiss', 'french', 'italian', 'japanese', 'german', 'dutch', 'spanish', 'greek',
  'nordic', 'scandinavian', 'american', 'british', 'english', 'soviet', 'russian',
  'chinese', 'korean', 'indian', 'persian', 'moroccan', 'brazilian', 'mexican',
  'bauhaus', 'deco', 'nouveau', 'victorian', 'edwardian', 'gothic', 'baroque',
  'brutalist', 'modernist', 'retro', 'vintage', 'classic', 'contemporary',
])

// A place named after one of these is the subject, not a flourish.
const LOCATIVE = new Set(['of', 'in', 'at', 'from', 'around', 'near', 'over', 'across', 'through'])

export type PlaceMention = { text: string; query: string; strong: boolean }

const titleCased = (word: string) => /^[A-Z][a-z'’-]+$/.test(word)
const acronym = (word: string) => /^[A-Z]{2,5}$/.test(word)

/**
 * Pull candidate place mentions out of free-form prompt text.
 *
 * Deliberately a heuristic and not an LLM call: it runs on every keystroke, must
 * be deterministic so the user can predict the chips, and a wrong guess costs
 * nothing because the user still has to click one.
 */
export const extractPlaceMentions = (prompt: string, limit = 4): PlaceMention[] => {
  const cleaned = prompt.replace(/[^\p{L}\p{N}\s,.'’-]/gu, ' ')
  const words = cleaned.split(/\s+/).filter(Boolean)
  const found: PlaceMention[] = []
  const seen = new Set<string>()

  const push = (text: string, query: string, strong: boolean) => {
    const key = query.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    found.push({ text, query, strong })
  }

  for (let index = 0; index < words.length; index += 1) {
    const bare = words[index].replace(/[.,]+$/, '')
    if (!bare) continue
    const lower = bare.toLowerCase()

    const previous = index > 0 ? words[index - 1].replace(/[.,]+$/, '').toLowerCase() : ''
    const strong = LOCATIVE.has(previous)

    if (ALIASES[lower] && (acronym(bare) || titleCased(bare))) {
      push(bare, ALIASES[lower], strong)
      continue
    }
    if (STOPWORDS.has(lower)) continue
    // A style word only counts as a place when the sentence puts it in a
    // locative slot ("a poster of Swiss villages").
    if (STYLE_WORDS.has(lower) && !strong) continue

    if (titleCased(bare)) {
      // Greedily absorb following capitalised words: "New York City", "Kuala Lumpur".
      const parts = [bare]
      let ahead = index + 1
      while (ahead < words.length && parts.length < 4) {
        const next = words[ahead].replace(/[.,]+$/, '')
        if (!titleCased(next) || STOPWORDS.has(next.toLowerCase())) break
        parts.push(next)
        ahead += 1
      }
      index = ahead - 1
      const phrase = parts.join(' ')
      push(phrase, phrase, strong)
      continue
    }
    if (acronym(bare) && !STOPWORDS.has(lower)) push(bare, bare, strong)
  }

  // An acronym on its own is ambiguous — "DPR" is a building in Jakarta and a
  // park in Bandung. When the prompt also names somewhere later, carry that
  // along as a qualifier so the lookup lands on the one the writer meant.
  const qualifier = found.at(-1)
  const qualified = found.map((mention, position) => {
    const isAcronym = mention.text.length <= 4 && mention.text === mention.text.toUpperCase()
    // An acronym we already expand (NYC, LA) is unambiguous on its own.
    const alreadyKnown = mention.query.toLowerCase() !== mention.text.toLowerCase()
    const needsContext = isAcronym && !alreadyKnown && qualifier && position < found.length - 1
    return needsContext ? { ...mention, query: `${mention.query} ${qualifier.query}` } : mention
  })

  // A place the sentence points at outranks one merely mentioned.
  return qualified.sort((a, b) => Number(b.strong) - Number(a.strong)).slice(0, limit)
}

/**
 * True when the locked place plainly matches something the prompt names.
 *
 * Checks every name we hold for the place, not just one: a geocoder may answer
 * in the local language, so "Kyoto" must still match a place whose official
 * label came back as 京都市 but which the user reached by asking for Kyoto.
 */
export const promptMatchesPlace = (mentions: PlaceMention[], ...placeNames: Array<string | undefined>) => {
  if (!mentions.length) return true
  const haystacks = placeNames.filter((name): name is string => Boolean(name)).map((name) => name.toLowerCase())
  if (!haystacks.length) return true
  return mentions.some(({ text, query }) =>
    haystacks.some((haystack) => haystack.includes(text.toLowerCase()) || haystack.includes(query.toLowerCase())))
}
