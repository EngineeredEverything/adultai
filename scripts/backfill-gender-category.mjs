#!/usr/bin/env node
/**
 * Backfill script: gender tags + recategorize "Erotic" images
 *
 * - Tags all images missing a gender field using prompt keyword analysis
 * - Recategorizes images tagged as "Erotic" (too generic) with a more specific category
 * - Dry-run by default: pass --apply to write changes
 *
 * Usage:
 *   node scripts/backfill-gender-category.mjs          # dry run
 *   node scripts/backfill-gender-category.mjs --apply  # write to DB
 */

import { MongoClient, ObjectId } from "mongodb"
import * as dotenv from "dotenv"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, "../.env.production") })

const DRY_RUN = !process.argv.includes("--apply")
const DB_URL = process.env.DATABASE_URL
if (!DB_URL) throw new Error("DATABASE_URL not set")

// ─── Inline category map (mirrors category-analyzer.ts) ──────────────────────
const CATEGORY_MAP = [
  ["Blowjob",       ["blowjob","blow job","fellatio","sucking cock","sucking dick","oral sex","deepthroat","deep throat","cock sucking","dick sucking","giving head"]],
  ["Anal",          ["anal","ass fuck","butt fuck","anally","sodomy","anal sex","anal penetration"]],
  ["Cumshot",       ["cumshot","cum shot","facial cum","cum on face","cum on her","creampie","cum dripping","covered in cum","ejaculation","squirting"]],
  ["Masturbation",  ["masturbat","fingering herself","touching herself","rubbing herself","dildo","vibrator","playing with herself","self pleasure"]],
  ["Femdom",        ["femdom","dominatrix","mistress","pegging","strapon","strap-on","female dominant","dominates him","chastity cage"]],
  ["BDSM",          ["bdsm","bondage","bound and","tied up","tied down","restrained","blindfold","handcuffs","spanking","flogging","whip","collar leash","submissive","dungeon","discipline"]],
  ["Lesbian",       ["lesbian","girl on girl","two women kissing","two girls","sapphic","pussy licking","scissoring","tribbing","cunnilingus","eating her out","eating pussy"]],
  ["Hardcore",      ["gangbang","gang bang","group sex","double penetration","dp ","orgy"]],
  ["Couples",       ["making love","sex with","fucking","intercourse","penetration","riding him","cowgirl position","missionary","doggy style","doggystyle","reverse cowgirl","mating press","prone bone","couple having"]],
  ["Hentai",        ["hentai","ahegao","tentacle","ecchi","waifu","anime girl","animated porn","manga style"]],
  ["POV",           ["pov","point of view","first person view"]],
  ["Futanari",      ["futanari","futa ","hermaphrodite","dickgirl"]],
  // NOTE: "Erotic" intentionally omitted — we skip it and use next match instead
  ["Witch",         ["witch","sorceress","witchcraft","coven","spell casting"]],
  ["Vampire",       ["vampire","vampiress","fangs dripping","undead seductress"]],
  ["Demon",         ["demon","succubus","devil girl","hellfire","demonic","infernal"]],
  ["Angel",         ["angel","angelic","halo","heaven","celestial","seraphim"]],
  ["Elf",           ["elf ","elven","elvish"," fae ","fairy ","faerie","pixie","wood elf","night elf","high elf"]],
  ["Furry",         ["furry","anthro ","wolf girl","fox girl","neko ","kemonomimi"]],
  ["Fantasy",       ["fantasy","magical girl","mystical","enchanted","dragon","knight","medieval","princess","realm","mythical"]],
  ["Cosplay",       ["cosplay","dressed as","superhero","comic book","marvel","dc hero","anime cosplay","halloween costume"]],
  ["Maid",          ["maid outfit","maid uniform","maid dress","maid apron","french maid"]],
  ["Nurse",         ["nurse outfit","nurse uniform","nurse costume","sexy nurse","medical uniform"]],
  ["Bunny",         ["bunny suit","playboy bunny","bunny ears","bunny costume","rabbit ears","bunny girl"]],
  ["Schoolgirl",    ["schoolgirl","school uniform","sailor uniform","pleated skirt","blazer and tie","classroom","student uniform"]],
  ["Latex",         ["latex","pvc outfit","rubber suit","catsuit","latex dress","latex suit","shiny latex"]],
  ["Stockings",     ["stockings","thigh highs","thigh-highs","fishnet stocking","hold-ups","nylons","garter belt","garter"]],
  ["Lingerie",      ["lingerie","bra and panties","thong","g-string","teddy","corset","bralette","lace underwear","babydoll","negligee","bodystocking","chemise"]],
  ["Bikini",        ["bikini","swimsuit","swimwear","bathing suit","two-piece","two piece swimsuit"]],
  ["Anime",         ["anime","manga","cel shaded","kawaii","2d art","chibi","illustrated woman","drawn"]],
  ["Cartoon",       ["cartoon","toon","animated","pixar style","disney style","stylized 3d","comic style"]],
  ["Pin-Up",        ["pin-up","pin up","pinup","nose art","1940s","1950s","1960s","cheesecake pose"]],
  ["Vintage",       ["vintage photo","retro photo","film noir","sepia tone","old photograph","grainy film"]],
  ["Fine Art",      ["fine art","oil painting","watercolor","renaissance","baroque","impressionist","canvas portrait"]],
  ["Glamour",       ["glamour shot","editorial","high fashion","couture","runway","magazine shoot","fashion photo"]],
  ["Artistic Nude", ["artistic nude","tasteful nude","art nude","figure study","boudoir","implied nude","elegant nude"]],
  ["Busty",         ["busty","large breasts","big breasts","big tits","huge tits","huge breasts","buxom","massive tits","huge boobs","big boobs"]],
  ["Curvy",         ["curvy","thicc","thick body","full figured","hourglass figure","wide hips","plus size","bbw"]],
  ["Petite",        ["petite","slim","slender","small and","tiny ","flat chested","flat chest","small breasts","small tits","lithe","delicate"]],
  ["Athletic",      ["athletic","muscular","toned body","sporty","six pack abs","sixpack","gym body","fitness model","ripped","buff"]],
  ["Mature",        ["mature woman","milf","cougar","older woman","middle aged","housewife"]],
  ["Asian",         ["asian","japanese","chinese","korean","vietnamese","thai","filipina","east asian"]],
  ["Latina",        ["latina","hispanic","mexican","brazilian","spanish woman","colombian","latin woman"]],
  ["Ebony",         ["ebony","black woman","african american","dark skin","melanin","nubian","dark skinned"]],
  ["Redhead",       ["redhead","red hair","ginger hair","auburn hair","copper hair"]],
  ["Blonde",        ["blonde","blond hair","golden hair","platinum blonde","bleach blonde"]],
  ["Brunette",      ["brunette","brown hair","dark hair","chestnut hair"]],
  ["Shower",        ["in the shower","shower scene","bathroom","bathtub","wet and soapy","steamy shower"]],
  ["Beach",         ["beach","ocean shore","sea shore","sand","coastal","seaside","tropical beach","island"]],
  ["Poolside",      ["pool","poolside","swimming pool","pool party","hot tub","jacuzzi","floating in"]],
  ["Bedroom",       ["bedroom","on the bed","in bed","pillow","sheets","mattress","boudoir","waking up"]],
  ["Outdoor",       ["outdoor","outside","nature","forest","park","garden","field","grass","trees","woods","backyard","patio","open air"]],
  ["Office",        ["office","desk","cubicle","boardroom","secretary","corporate","business woman","conference room"]],
  ["Kitchen",       ["kitchen","counter","stove","sink","cooking","chef apron","dining table"]],
  ["Rooftop",       ["rooftop","roof terrace","skyline","penthouse","city view","high rise"]],
  ["Bar",           ["nightclub","night club","pub ","bar ","cocktail bar","lounge","dance floor","rave","nightlife"]],
  ["Naked",         ["naked","nude","topless","bottomless","bare body","undressed","no clothes","unclothed","full frontal","naturist","nudist"]],
  // Erotic last — only used if truly nothing else matches
  ["Erotic",        ["erotic","sensual","intimate","seductive","teasing","provocative","alluring","sultry"]],
]

const MALE_PATTERNS = [
  /\bmale\b/, /\b(?<!wo)man\b/, /\b(?<!wo)men\b/,
  /\bguy\b/, /\bguys\b/, /\bboy\b/, /\bboys\b/,
  /\bdude\b/, /\bmasculine\b/, /\bgay\b/,
  /\bhim\b/, /\bhis\s+body\b/, /\bbulge\b/,
  /\bcock\b/, /\bpenis\b/, /\berect\b/, /\bdaddy\b/, /\bhunk\b/,
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

function detectGender(prompt) {
  if (!prompt) return "female"
  const text = prompt.toLowerCase()
  if (FANTASY_PATTERNS.some(r => r.test(text))) return "fantasy"
  const hasMale = MALE_PATTERNS.some(r => r.test(text))
  const hasFemale = FEMALE_PATTERNS.some(r => r.test(text))
  if (hasMale && !hasFemale) return "male"
  return "female"
}

function detectCategory(prompt) {
  if (!prompt) return null
  const text = prompt.toLowerCase()
  for (const [name, keywords] of CATEGORY_MAP) {
    for (const kw of keywords) {
      if (text.includes(kw)) return name
    }
  }
  return null
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const client = new MongoClient(DB_URL)
await client.connect()
const db = client.db()

// Build category name → id map
const categoryDocs = await db.collection("Category").find({}).toArray()
const catMap = new Map(categoryDocs.map(c => [c.name, c._id.toString()]))
console.log(`Loaded ${catMap.size} categories`)

const eroticId = catMap.get("Erotic")
if (!eroticId) throw new Error("Erotic category not found in DB")

// Fetch all images that need work:
// 1. No gender field, OR gender is null
// 2. OR currently tagged as Erotic only
const images = await db.collection("GeneratedImage").find({
  $or: [
    { gender: { $exists: false } },
    { gender: null },
    { categoryIds: eroticId },
  ]
}).project({ _id: 1, prompt: 1, gender: 1, categoryIds: 1 }).toArray()

console.log(`Found ${images.length} images to process`)
console.log(DRY_RUN ? "DRY RUN — no changes will be written\n" : "APPLYING changes...\n")

let genderTagged = 0
let recategorized = 0
let recatToErotic = 0
let skipped = 0

const OPS = []

for (const img of images) {
  const prompt = img.prompt || ""
  const update = {}

  // 1. Gender tagging
  if (!img.gender) {
    update.gender = detectGender(prompt)
    genderTagged++
  }

  // 2. Recategorize if currently Erotic
  const currentCatIds = img.categoryIds || []
  const isErotic = currentCatIds.includes(eroticId)

  if (isErotic) {
    const newCatName = detectCategory(prompt)

    if (newCatName && newCatName !== "Erotic") {
      const newCatId = catMap.get(newCatName)
      if (newCatId) {
        // Replace Erotic with the new category
        const newCatIds = currentCatIds.filter(id => id !== eroticId)
        if (!newCatIds.includes(newCatId)) newCatIds.push(newCatId)
        update.categoryIds = newCatIds
        recategorized++
        if (DRY_RUN) console.log(`  [RECATEGORIZE] "${prompt.slice(0,80)}" → ${newCatName}`)
      } else {
        // Category exists in map but not in DB — keep Erotic
        skipped++
      }
    } else if (!newCatName) {
      // No match at all — strip Erotic, leave uncategorized
      update.categoryIds = currentCatIds.filter(id => id !== eroticId)
      recategorized++
      if (DRY_RUN) console.log(`  [STRIP EROTIC] "${prompt.slice(0,80)}" → (uncategorized)`)
    } else {
      // Best match is still Erotic — keep it
      recatToErotic++
    }
  }

  if (Object.keys(update).length > 0) {
    OPS.push({ id: img._id, update })
  }
}

console.log(`\nSummary:`)
console.log(`  Gender tags to add:     ${genderTagged}`)
console.log(`  Erotic → recategorized: ${recategorized}`)
console.log(`  Erotic → stays erotic:  ${recatToErotic}`)
console.log(`  Skipped (cat missing):  ${skipped}`)
console.log(`  Total ops:              ${OPS.length}`)

if (!DRY_RUN && OPS.length > 0) {
  console.log("\nWriting to DB in batches of 500...")
  let written = 0
  for (let i = 0; i < OPS.length; i += 500) {
    const batch = OPS.slice(i, i + 500)
    const bulkOps = batch.map(op => ({
      updateOne: {
        filter: { _id: op.id },
        update: { $set: op.update },
      }
    }))
    const result = await db.collection("GeneratedImage").bulkWrite(bulkOps, { ordered: false })
    written += result.modifiedCount
    process.stdout.write(`  ${written}/${OPS.length} written\r`)
  }
  console.log(`\nDone. ${written} images updated.`)
} else if (DRY_RUN) {
  console.log("\nRun with --apply to commit changes.")
}

await client.close()
