# Esther

A mobile-first PWA for reading and listening to the Book of Esther in three
Tibetan dialects — Amdo, Kham, and Central — with English, Chinese, Hindi and
Nepali text as reading languages. Built for New Tibetan Bible
(new-tibetan-bible.com). A sibling of the Jonah and Ruth apps — same
architecture, different book.

Works offline once installed: all text, images and the app itself are cached
at install; audio is cached the first time each track is played (the whole audio set is
~66MB, so it isn't downloaded up front).

## Tech stack

- **Astro 5**, static output (no SSR adapter)
- **Tailwind CSS v4** via the Vite plugin
- **Astro Content Collections** using the Astro 5 loader API (`src/content.config.ts`)
- **@vite-pwa/astro** (custom `src/sw.js`, `injectManifest`) for offline support
- Vanilla JS only — no React/Vue/framework islands
- **Lucide** icons

## Project layout

```
source-assets/          Original files from the client — the five source texts
                         (SFM + USFM), the PDF layout model, the 45 illustration
                         JPGs, navbar/share/About artwork, fonts, per-dialect
                         verse-timing exports (timing/), and the whole-Bible
                         intro RTF + timeline PNGs. Not used directly by the
                         app; the source of truth for regeneration. (John's
                         original mp3s stay in the shared Drive folder.)
scripts/
  gen-chapters.mjs       Parses the source texts and timing files into
                         src/content/{chapters,intro,bible-intro,timeline}/*.json.
                         Re-run `npm run gen-chapters` whenever a source changes —
                         don't hand-edit the generated JSON.
src/
  content.config.ts      Content collection schemas
  content/               Generated data (verses, verse-bridge labels, inline
                         image placement, audio paths, durations, timing)
  assets/chapters/       Cover + inline illustration images (webp)
  assets/branding/       Header wordmark + About banner
  assets/timeline/       The six Creation-to-Christ timeline pages (webp)
  components/            ChapterCard.astro
  i18n/settings-store.ts Reading settings + AVAILABLE_DIALECTS (audio tracks)
  layouts/               Layout.astro
  pages/                 index.astro (home + reading modal), chapter/[n].astro
                         (static fallback for direct links / crawlers)
  sw.js                  Hand-written service worker (Range-aware audio cache)
public/
  audio/{adx,bod,khg,eng}/ Audio, chapter-N.mp3 (44.1kHz mono 64kbps)
  fonts/                  Self-hosted Tibetan + Chinese fonts
  icons/                  PWA icons
```

## Audio

The three Tibetan dialects (John's recordings), English (the BSB reading) and
Chinese (CUV, Wordproject's recording). English and Chinese verse timing is
generated locally — see `scripts/english-timing/` and `scripts/chinese-timing/`.
`AVAILABLE_DIALECTS` in `src/i18n/settings-store.ts` is the single switch for
which tracks the app offers — see CLAUDE.md for how to add more.

## Image placement

Each illustration is named `17_Es_<chapter>_<verse>_RG.jpg` and is placed
after that verse — see the `INLINE_IMAGES` map in `scripts/gen-chapters.mjs`.
These placements follow John's filenames and have not been fully verified
against the PDF model (it only embeds 28 of the 45).

## Development

```bash
npm install
npm run dev       # http://localhost:4417
npm run build     # -> dist/
npm run preview
```

## Deployment

Static build, deployed to Netlify via GitHub auto-deploy on push to `main`.
