// category-analyzer.ts
// Returns a SINGLE best-match category for a prompt.
// Order matters — more specific entries take priority over generic ones.

// [categoryName, keywords[]] — first keyword match wins, entries checked top-to-bottom
const CATEGORY_MAP: [string, string[]][] = [
  // === ACT (most specific first) ===
  ["Blowjob",      ["blowjob","blow job","fellatio","sucking cock","sucking dick","oral sex","deepthroat","deep throat","cock sucking","dick sucking","giving head"]],
  ["Anal",         ["anal","ass fuck","butt fuck","anally","sodomy","anal sex","anal penetration"]],
  ["Cumshot",      ["cumshot","cum shot","facial cum","cum on face","cum on her","creampie","cum dripping","covered in cum","ejaculation","squirting"]],
  ["Masturbation", ["masturbat","fingering herself","touching herself","rubbing herself","dildo","vibrator","playing with herself","self pleasure"]],
  ["Femdom",       ["femdom","dominatrix","mistress","pegging","strapon","strap-on","female dominant","dominates him","chastity cage"]],
  ["BDSM",         ["bdsm","bondage","bound and","tied up","tied down","restrained","blindfold","handcuffs","spanking","flogging","whip","collar leash","submissive","dungeon","discipline"]],
  ["Lesbian",      ["lesbian","girl on girl","two women kissing","two girls","sapphic","pussy licking","scissoring","tribbing","cunnilingus","eating her out","eating pussy"]],
  ["Hardcore",     ["gangbang","gang bang","group sex","double penetration","dp ","orgy"]],
  ["Couples",      ["making love","sex with","fucking","intercourse","penetration","riding him","cowgirl position","missionary","doggy style","doggystyle","reverse cowgirl","mating press","prone bone","couple having"]],
  ["Hentai",       ["hentai","ahegao","tentacle","ecchi","waifu","anime girl","animated porn","manga style"]],
  ["POV",          ["pov","point of view","first person view"]],
  ["Futanari",     ["futanari","futa ","hermaphrodite","dickgirl"]],
  ["Erotic",       ["erotic","sensual","intimate","seductive","teasing","provocative","alluring","sultry"]],

  // === CHARACTER ===
  ["Sofanda Cox",  ["sofanda","sofandacox","sofonda","sofondacox"]],

  // === FANTASY / COSTUME ===
  ["Witch",        ["witch","sorceress","witchcraft","coven","spell casting"]],
  ["Vampire",      ["vampire","vampiress","fangs dripping","undead seductress"]],
  ["Demon",        ["demon","succubus","devil girl","hellfire","demonic","infernal"]],
  ["Angel",        ["angel","angelic","halo","heaven","celestial","seraphim"]],
  ["Elf",          ["elf ","elven","elvish"," fae ","fairy ","faerie","pixie","wood elf","night elf","high elf"]],
  ["Furry",        ["furry","anthro ","wolf girl","fox girl","neko ","kemonomimi"]],
  ["Fantasy",      ["fantasy","magical girl","mystical","enchanted","dragon","knight","medieval","princess","realm","mythical"]],
  ["Cosplay",      ["cosplay","dressed as","superhero","comic book","marvel","dc hero","anime cosplay","halloween costume"]],

  // === OUTFIT ===
  ["Maid",         ["maid outfit","maid uniform","maid dress","maid apron","french maid"]],
  ["Nurse",        ["nurse outfit","nurse uniform","nurse costume","sexy nurse","medical uniform"]],
  ["Bunny",        ["bunny suit","playboy bunny","bunny ears","bunny costume","rabbit ears","bunny girl"]],
  ["Schoolgirl",   ["schoolgirl","school uniform","sailor uniform","pleated skirt","blazer and tie","classroom","student uniform"]],
  ["Latex",        ["latex","pvc outfit","rubber suit","catsuit","latex dress","latex suit","shiny latex"]],
  ["Stockings",    ["stockings","thigh highs","thigh-highs","fishnet stocking","hold-ups","nylons","garter belt","garter"]],
  ["Lingerie",     ["lingerie","bra and panties","thong","g-string","teddy","corset","bralette","lace underwear","babydoll","negligee","bodystocking","chemise"]],
  ["Bikini",       ["bikini","swimsuit","swimwear","bathing suit","two-piece","two piece swimsuit"]],

  // === ART STYLE ===
  ["Anime",        ["anime","manga","cel shaded","kawaii","2d art","chibi","illustrated woman","drawn"]],
  ["Cartoon",      ["cartoon","toon","animated","pixar style","disney style","stylized 3d","comic style"]],
  ["Pin-Up",       ["pin-up","pin up","pinup","nose art","1940s","1950s","1960s","cheesecake pose"]],
  ["Vintage",      ["vintage photo","retro photo","film noir","sepia tone","old photograph","grainy film"]],
  ["Fine Art",     ["fine art","oil painting","watercolor","renaissance","baroque","impressionist","canvas portrait"]],
  ["Glamour",      ["glamour shot","editorial","high fashion","couture","runway","magazine shoot","fashion photo"]],
  ["Artistic Nude",["artistic nude","tasteful nude","art nude","figure study","boudoir","implied nude","elegant nude"]],

  // === BODY TYPE ===
  ["Busty",        ["busty","large breasts","big breasts","big tits","huge tits","huge breasts","buxom","massive tits","huge boobs","big boobs"]],
  ["Curvy",        ["curvy","thicc","thick body","full figured","hourglass figure","wide hips","plus size","bbw"]],
  ["Petite",       ["petite","slim","slender","small and","tiny ","flat chested","flat chest","small breasts","small tits","lithe","delicate"]],
  ["Athletic",     ["athletic","muscular","toned body","sporty","six pack abs","sixpack","gym body","fitness model","ripped","buff"]],
  ["Mature",       ["mature woman","milf","cougar","older woman","middle aged","housewife"]],

  // === ETHNICITY ===
  ["Asian",        ["asian","japanese","chinese","korean","vietnamese","thai","filipina","east asian"]],
  ["Latina",       ["latina","hispanic","mexican","brazilian","spanish woman","colombian","latin woman"]],
  ["Ebony",        ["ebony","black woman","african american","dark skin","melanin","nubian","dark skinned"]],
  ["Redhead",      ["redhead","red hair","ginger hair","auburn hair","copper hair"]],
  ["Blonde",       ["blonde","blond hair","golden hair","platinum blonde","bleach blonde"]],
  ["Brunette",     ["brunette","brown hair","dark hair","chestnut hair"]],

  // === SETTING ===
  ["Shower",       ["in the shower","shower scene","bathroom","bathtub","wet and soapy","steamy shower"]],
  ["Beach",        ["beach","ocean shore","sea shore","sand","coastal","seaside","tropical beach","island"]],
  ["Poolside",     ["pool","poolside","swimming pool","pool party","hot tub","jacuzzi","floating in"]],
  ["Bedroom",      ["bedroom","on the bed","in bed","pillow","sheets","mattress","boudoir","waking up"]],
  ["Outdoor",      ["outdoor","outside","nature","forest","park","garden","field","grass","trees","woods","backyard","patio","open air"]],
  ["Office",       ["office","desk","cubicle","boardroom","secretary","corporate","business woman","conference room"]],
  ["Kitchen",      ["kitchen","counter","stove","sink","cooking","chef apron","dining table"]],
  ["Rooftop",      ["rooftop","roof terrace","skyline","penthouse","city view","high rise"]],
  ["Bar",          ["nightclub","night club","pub ","bar ","cocktail bar","lounge","dance floor","rave","nightlife"]],

  // === NAKED (fallback nudity) ===
  ["Naked",        ["naked","nude","topless","bottomless","bare body","undressed","no clothes","unclothed","full frontal","naturist","nudist"]],
]

/**
 * Returns the single best matching category name for a prompt,
 * or null if no match (caller should use "Uncategorized").
 */
export function analyzePromptForCategory(prompt: string): string | null {
  if (!prompt || prompt.trim() === '') return null
  const text = prompt.toLowerCase()
  for (const [name, keywords] of CATEGORY_MAP) {
    for (const kw of keywords) {
      if (text.includes(kw)) return name
    }
  }
  return null
}

// Legacy multi-category export kept for any callers that still use it
// Returns array with single best match (or empty if no match)
export function analyzePromptForCategories(
  prompt: string,
  _categories?: unknown[],
  _maxCats?: number
): string[] {
  const best = analyzePromptForCategory(prompt)
  return best ? [best] : []
}

// ─── Gender / content-type detection ───────────────────────────────────────

// Word-boundary regex patterns for male-subject prompts.
// These must NOT match inside female words (e.g. "woman", "shimmer").
const MALE_PATTERNS = [
  /\bmale\b/,
  /\b(?<!wo)man\b/,        // "man" but not "woman"
  /\b(?<!wo)men\b/,        // "men" but not "women"
  /\bguy\b/, /\bguys\b/,
  /\bboy\b/, /\bboys\b/,
  /\bdude\b/, /\bmasculine\b/,
  /\bmuscular man\b/, /\bgay\b/, /\bbisexual man\b/,
  /\bhim\b/,               // "him" but not "shimmer"
  /\bhis\s+body\b/,
  /\bbulge\b/, /\bcock\b/, /\bpenis\b/, /\berect\b/,
  /\bdaddy\b/, /\bhunk\b/,
]

const FEMALE_PATTERNS = [
  /\bwoman\b/, /\bwomen\b/, /\bgirl\b/, /\bgirls\b/,
  /\bfemale\b/, /\bshe\b/, /\bher\b/, /\blady\b/,
  /\bgoddess\b/, /\bmilf\b/, /\bwife\b/, /\bgirlfriend\b/,
  /\bbabe\b/, /\bbeauty\b/, /\bprincess\b/, /\bqueen\b/,
  /\bbreasts?\b/, /\bboobs?\b/, /\btits?\b/, /\bpussy\b/, /\bvagina\b/,
  /\bcleavage\b/, /\bthong\b/, /\blingerie\b/, /\bbikini\b/, /\bbra\b/,
]

const FANTASY_PATTERNS = [
  /\belf\b/, /\belven\b/, /\bdemon\b/, /\bangel\b/, /\bvampire\b/,
  /\bwitch\b/, /\bdragon\b/, /\borc\b/, /\balien\b/, /\brobot\b/,
  /\bcyborg\b/, /\bmermaid\b/, /\bfurry\b/, /\banthro\b/,
  /\bhentai\b/, /\banime\b/, /\bfantasy\b/, /\bmagical\b/,
  /\bmythical\b/, /\bmonster\b/, /\bcreature\b/, /\btentacle\b/,
  /\bsuccubus\b/, /\bneko\b/, /\bcatgirl\b/,
]

/**
 * Detect the content gender/type from a prompt.
 * Uses word-boundary regex to avoid false positives (e.g. "woman" ≠ "man").
 * Returns: "male" | "female" | "fantasy" | "other"
 */
export function detectGender(prompt: string): "male" | "female" | "fantasy" | "other" {
  if (!prompt) return "other"
  const text = prompt.toLowerCase()

  // Fantasy check first (overrides gender)
  if (FANTASY_PATTERNS.some(re => re.test(text))) return "fantasy"

  const hasMale = MALE_PATTERNS.some(re => re.test(text))
  const hasFemale = FEMALE_PATTERNS.some(re => re.test(text))

  // If both detected, the subject is likely female (e.g. "her boyfriend watches him")
  // If only male, it's male content
  if (hasMale && !hasFemale) return "male"
  if (hasFemale) return "female"

  // Default to female (platform is female-dominant content)
  return "female"
}
