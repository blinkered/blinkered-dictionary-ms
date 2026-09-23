/**
 * The collections that attest Bahasa Melayu, and where each comes from.
 *
 * Malay has a 7,921-word candidate list, drawn from film subtitles and checked against
 * Wiktionary's Malay categories, against a 410MB Wikipedia, Leipzig news and a Malaysian web
 * crawl, a Malaysian New Testament and the Internet Archive.
 *
 * The risk particular to Malay is Indonesian. The two are one language written to two standards,
 * so most of the candidates are Indonesian words too, and a collection that is really Indonesian
 * would attest them just as well. That cannot corrupt a candidate that is Malay and Indonesian at
 * once, which is most of them; it can carry a Malay candidate that Indonesian spells the same way
 * and uses differently. So each source leans Malaysian where there is a choice: the Leipzig web
 * crawl is the `msa-my` one, the Bible is the Malaysian KSZI, and the publishers are Malaysian.
 *
 * Every URL here was probed before it was written down. A collection that 404s does not fail
 * loudly — the build skips it with a warning and reports a healthy number over fewer families.
 */
import { createReadStream, existsSync, readFileSync, readdirSync } from 'node:fs'
import { createInterface } from 'node:readline'
import {
  fileDocuments,
    harvestDocuments,
  leipzigLocators,
  leipzigSentences,
  tatoebaDocuments,
  verseDocuments,
  wikiDocuments,
} from '@blinkered/attestation'

export const LANGUAGE = 'ms'

const CACHE = new URL('.cache/raw/', import.meta.url).pathname

/** A Leipzig package, with its sentence-to-URL index resolved up front. */
function leipzig(pkg) {
  const base = `${CACHE}${pkg}/${pkg}`
  const locators = leipzigLocators(
    readFileSync(`${base}-inv_so.txt`, 'utf8'),
    readFileSync(`${base}-sources.txt`, 'utf8'),
  )
  const lines = createInterface({
    input: createReadStream(`${base}-sentences.txt`),
    crlfDelay: Infinity,
  })
  return leipzigSentences(lines, locators)
}

// News and the Malaysian web crawl. Leipzig's `msa` code is the Malay macrolanguage, which in
// practice means Malaysian and Bruneian sources as well as some Indonesian ones; `msa-my` is the
// web crawl restricted to Malaysia. The Leipzig Wikipedia packages are deliberately absent: they
// are Wikipedia text wearing a Leipzig label, so including one would corroborate `wiki:ms` while
// looking like another family.
const LEIPZIG = [
  'msa_news_2019_100K',
  'msa_newscrawl_2011_100K',
  'msa_newscrawl_2016_300K',
  'msa-my_web_2013_1M',
]

// The Malaysian New Testament, Kitab Suci Zaman Ini. eBible's other Malays are Kupang and Papuan,
// which are different languages.
const EBIBLE = ['zlmKSZI']

/**
 * Indonesian, which the legibility floor cannot catch because it is the same language.
 *
 * What the Archive catalogues as Malay is mostly not Malaysian. Of its first 56 texts, 47 were
 * English, Urdu or Arabic works mistagged and are stopped by the floor; of the eight that passed
 * it, seven were Indonesian (Hamka's Tafsir al-Azhar, Indonesian translations of al-Ghazali). An
 * Indonesian book proves an Indonesian word, and the list is Malay. Five pairs of words where the
 * standards differ tell them apart: KARENA, BISA, UANG, KANTOR and SAJA against KERANA, BOLEH,
 * WANG, PEJABAT and SAHAJA. A book where the Indonesian five outnumber the Malaysian five more
 * than two to one is read as empty.
 */
const INDONESIAN = new Set(['karena', 'bisa', 'uang', 'kantor', 'saja'])
const MALAYSIAN = new Set(['kerana', 'boleh', 'wang', 'pejabat', 'sahaja'])
function isIndonesian(text) {
  let indonesian = 0
  let malaysian = 0
  for (const match of text.matchAll(/\p{L}+/gu)) {
    const word = match[0].toLowerCase()
    if (INDONESIAN.has(word)) indonesian += 1
    else if (MALAYSIAN.has(word)) malaysian += 1
  }
  return indonesian >= 10 && indonesian > 2 * malaysian
}

/**
 * Word lists are not text, and the Archive's Malay shelf is thick with them: nineteenth-century
 * Malay-English, Malay-Dutch and Malay-French dictionaries and a Palembang glossary. A list
 * attests a word by listing it, which is a dictionary's testimony rather than a collection's.
 */
const LEXICON = /kamus|dictionar|dictionnaire|woordenboek|vocabular|glossar/iu

const ALL = [
  {
    id: 'wiki:ms',
    what: 'Malay Wikipedia — modern encyclopedic prose',
    needs: `${CACHE}mswiki.xml.bz2`,
    documents: () => wikiDocuments(`${CACHE}mswiki.xml.bz2`),
  },
  {
    id: 'wikisource:ms',
    what: 'Malay Wikisource — same Wikimedia family, so it corroborates rather than counts',
    needs: `${CACHE}mswikisource.xml.bz2`,
    documents: () => wikiDocuments(`${CACHE}mswikisource.xml.bz2`),
  },
  ...LEIPZIG.map((pkg) => ({
    id: `lz:${pkg}`,
    from: `https://downloads.wortschatz-leipzig.de/corpora/${pkg}.tar.gz`,
    what: `Leipzig ${pkg} — modern news and web text, cited by the page each sentence came from`,
    needs: `${CACHE}${pkg}`,
    documents: () => leipzig(pkg),
  })),
  {
    id: 'tat',
    from: 'https://downloads.tatoeba.org/exports/per_language/zsm/zsm_sentences.tsv.bz2',
    what: 'Tatoeba Standard Malay — contemporary and conversational, and small',
    needs: `${CACHE}zsm_sentences.tsv`,
    documents: () => tatoebaDocuments(`${CACHE}zsm_sentences.tsv`),
  },
  ...EBIBLE.map((translation) => ({
    id: `ebible:${translation}`,
    from: `https://ebible.org/Scriptures/${translation}_vpl.zip`,
    what: `eBible ${translation} — a family nothing else here belongs to`,
    needs: `${CACHE}ebible-${translation}/${translation}_vpl.txt`,
    documents: () => verseDocuments(`${CACHE}ebible-${translation}/${translation}_vpl.txt`),
  })),
  {
    id: 'ia',
    // Scanned books are OCR, and OCR fails in a way that looks like text. Clean Gutenberg scores
    // a median 52% known words and never below 36%; the worst of these scored 1%, an English
    // book read as Cyrillic. Below this floor a book is not legible enough to attest anything.
    legible: 0.35,
    what: 'Internet Archive Malay books — literature, and the register a newspaper never reaches',
    needs: `${CACHE}archive-ms`,
    from: 'https://archive.org/search?query=mediatype%3Atexts+AND+%28language%3A%22Malay%22+OR+language%3A%22may%22+OR+language%3A%22msa%22+OR+language%3A%22zsm%22%29',
    documents: () => {
      const dir = `${CACHE}archive-ms`
      // A locator names the text, not the item: the catalogue page holds no word of the book.
      const named = new Map(
        readFileSync(`${dir}/files.tsv`, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((line) => line.split('\t')),
      )
      const books = readdirSync(dir)
        .filter((file) => file.endsWith('.txt'))
        .map((file) => file.replace('.txt', ''))
        .filter((id) => named.has(id))
        .filter((id) => !LEXICON.test(`${id} ${named.get(id)}`))
        // Percent-encoded: two thirds of Archive filenames contain spaces, and the evidence
        // format spends spaces as separators.
        .map((id) => ({
          locator: `${id}/${encodeURIComponent(named.get(id))}`,
          path: `${dir}/${id}.txt`,
        }))
      return fileDocuments(books, async (path) => {
        const text = readFileSync(path, 'utf8')
        return isIndonesian(text) ? '' : text
      })
    },
  },
]

export const SOURCES = ALL.filter((source) => {
  if (source.needs === undefined || existsSync(source.needs)) return true
  process.stderr.write(`  (skipping ${source.id}: ${source.needs} is not in .cache/raw)\n`)
  return false
})

/**
 * Malaysian publishers, for the harvest.
 *
 * Chosen because they publish in Malay, and in Malaysia rather than Indonesia, rather than because
 * they are large. A harvester reads whatever it fetches and has no idea what language it is in.
 * Every one answered when probed; Berita Harian refused a plain request and is left out.
 */
export const DOMAINS = [
  'utusan.com.my', 'kosmo.com.my', 'sinarharian.com.my', 'hmetro.com.my', 'astroawani.com',
]

export const HARVEST = existsSync(new URL('searched.tsv', import.meta.url).pathname)
  ? () => harvestDocuments(new URL('searched.tsv', import.meta.url).pathname)
  : undefined

/** Carried over from Blinkered's calibration; must be re-measured before anything ships. */
export const COMMON_CUT = 17000
