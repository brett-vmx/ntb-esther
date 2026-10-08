// Parses 17ESTNTB.SFM (Tibetan) + EST.bsb.usfm (English) into per-chapter
// JSON content files at src/content/chapters/chapter-N.json.
//
// Run with: node scripts/gen-chapters.mjs
//
// Source files stay in source-assets/ — this script is the only thing that
// reads them; re-run it any time the source text changes instead of hand-editing
// the generated JSON.
//
// Esther's generator is Ruth's (itself ported from ntb-jonah's — same app,
// different book; see CLAUDE.md's "What this project is"), since Esther's
// source files have the same shape as Ruth's: plain-USFM English, multiple
// \s sub-headings per chapter, the book introduction typed into the SFM's
// own front matter. Differences from Ruth's, and why, are called out inline
// below; the overall shape (parse each language source into {label,
// section, verses}, merge into per-chapter blocks, attach audio/duration/
// timing) is unchanged.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const SFM_PATH = path.join(ROOT, 'source-assets/17ESTNTB.SFM');
// Unlike Jonah's English source (an RTF export), Esther's (like Ruth's)
// arrived as a plain USFM file (bsb2usfm-generated Berean Standard Bible)
// — actually simpler to parse than RTF, see parseBsbUsfm below.
const BSB_USFM_PATH = path.join(ROOT, 'source-assets/EST.bsb.usfm');
const CMN_USFM_PATH = path.join(ROOT, 'source-assets/17-ESTcmn-cu89s.usfm');
const HI_USFM_PATH = path.join(ROOT, 'source-assets/17-ESThin2017.usfm');
const NE_USFM_PATH = path.join(ROOT, 'source-assets/17-ESTnpiulb.usfm');
// NTB Bible introduction + Creation-to-Christ timeline — general, whole-
// Bible reference content (not tied to any one book), ported from
// ntb-jonah (via ntb-ruth) verbatim once Brett confirmed neither file mentions Jonah
// anywhere and John's own wording ("we would like it to be in the PWA
// apps") reads as "every book app", not "Jonah specifically". Same
// source files as ntb-jonah's own copies — see that project's CLAUDE.md
// for the full request history (John's "grand slam" comment, the
// RTF-decoding bug this uncovered, etc.). The Bible introduction RTF is
// the one thing here that needed decodeIntroRtf() ported over too — this
// script never needed RTF decoding before, since Esther's own book
// introduction above comes straight from the SFM's front matter.
const BIBLE_INTRO_RTF_PATH = path.join(ROOT, 'source-assets/Bible introduction for NTB – for NTB PWA apps.rtf');
const TIMELINE_ASSET_DIR = '../../assets/timeline'; // resolved by content.config.ts's image() helper, same convention as INLINE_DIR/COVER_DIR below
const TIMELINE_PAGE_COUNT = 6;
const TIMING_DIR = path.join(ROOT, 'source-assets/timing');
const OUT_DIR = path.join(ROOT, 'src/content/chapters');
const INTRO_OUT_DIR = path.join(ROOT, 'src/content/intro');
const BIBLE_INTRO_OUT_DIR = path.join(ROOT, 'src/content/bible-intro');
const TIMELINE_OUT_DIR = path.join(ROOT, 'src/content/timeline');

// Paths below are relative to src/content/chapters/, resolved by content.config.ts's
// image() schema helper — they point at the pre-optimized webp copies in src/assets/,
// not the original JPGs in source-assets/.
const INLINE_DIR = '../../assets/chapters/inline';
const COVER_DIR = '../../assets/chapters/covers';

// Inline illustration placement. Like Ruth's (and unlike Jonah's page-
// sequence filenames), Esther's illustrations are named directly by book/
// chapter/verse (17_Es_01_05_RG.jpg = book 17, chapter 1, verse 5), so the
// mapping below is read straight off each filename — "after" is the cited
// verse, "before" is always the very next one (documentation only; nothing
// reads it). John's 45 final illustrations are a trimmed subset of the 53
// that his Claude-Cowork "placement report" .docx files originally
// proposed (those reports' own constructed filenames, `17_Est_…`, don't
// match the real ones and aren't used by anything). The PDF model
// (NTB Esther_final.pdf) only embeds 28 images, so it can't confirm all of
// these either — flag for Brett/John to confirm before treating this as
// final. Chapter 10 has no illustration.
const INLINE_IMAGES = {
  1: [
    { after: 5, before: 6, file: `${INLINE_DIR}/17_Es_01_05_RG.webp` },
    { after: 8, before: 9, file: `${INLINE_DIR}/17_Es_01_08_RG.webp` },
    { after: 13, before: 14, file: `${INLINE_DIR}/17_Es_01_13_RG.webp` },
    { after: 21, before: 22, file: `${INLINE_DIR}/17_Es_01_21_RG.webp` },
  ],
  2: [
    { after: 3, before: 4, file: `${INLINE_DIR}/17_Es_02_03_RG.webp` },
    { after: 8, before: 9, file: `${INLINE_DIR}/17_Es_02_08_RG.webp` },
    { after: 17, before: 18, file: `${INLINE_DIR}/17_Es_02_17_RG.webp` },
    { after: 22, before: 23, file: `${INLINE_DIR}/17_Es_02_22_RG.webp` },
  ],
  3: [
    { after: 1, before: 2, file: `${INLINE_DIR}/17_Es_03_01_RG.webp` },
    { after: 2, before: 3, file: `${INLINE_DIR}/17_Es_03_02_RG.webp` },
    { after: 3, before: 4, file: `${INLINE_DIR}/17_Es_03_03_RG.webp` },
    { after: 4, before: 5, file: `${INLINE_DIR}/17_Es_03_04_RG.webp` },
    { after: 12, before: 13, file: `${INLINE_DIR}/17_Es_03_12_RG.webp` },
  ],
  4: [
    { after: 1, before: 2, file: `${INLINE_DIR}/17_Es_04_01_RG.webp` },
    { after: 2, before: 3, file: `${INLINE_DIR}/17_Es_04_02_RG.webp` },
    { after: 8, before: 9, file: `${INLINE_DIR}/17_Es_04_08_RG.webp` },
    { after: 9, before: 10, file: `${INLINE_DIR}/17_Es_04_09_RG.webp` },
    { after: 13, before: 14, file: `${INLINE_DIR}/17_Es_04_13_RG.webp` },
    { after: 15, before: 16, file: `${INLINE_DIR}/17_Es_04_15_RG.webp` },
  ],
  5: [
    { after: 1, before: 2, file: `${INLINE_DIR}/17_Es_05_01_RG.webp` },
    { after: 2, before: 3, file: `${INLINE_DIR}/17_Es_05_02_RG.webp` },
    { after: 4, before: 5, file: `${INLINE_DIR}/17_Es_05_04_RG.webp` },
    { after: 5, before: 6, file: `${INLINE_DIR}/17_Es_05_05_RG.webp` },
    { after: 9, before: 10, file: `${INLINE_DIR}/17_Es_05_09_RG.webp` },
    { after: 12, before: 13, file: `${INLINE_DIR}/17_Es_05_12_RG.webp` },
  ],
  6: [
    { after: 1, before: 2, file: `${INLINE_DIR}/17_Es_06_01_RG.webp` },
    { after: 5, before: 6, file: `${INLINE_DIR}/17_Es_06_05_RG.webp` },
    { after: 7, before: 8, file: `${INLINE_DIR}/17_Es_06_07_RG.webp` },
    { after: 8, before: 9, file: `${INLINE_DIR}/17_Es_06_08_RG.webp` },
    { after: 10, before: 11, file: `${INLINE_DIR}/17_Es_06_10_RG.webp` },
    { after: 12, before: 13, file: `${INLINE_DIR}/17_Es_06_12_RG.webp` },
  ],
  7: [
    { after: 1, before: 2, file: `${INLINE_DIR}/17_Es_07_01_RG.webp` },
    { after: 3, before: 4, file: `${INLINE_DIR}/17_Es_07_03_RG.webp` },
    { after: 6, before: 7, file: `${INLINE_DIR}/17_Es_07_06_RG.webp` },
    { after: 7, before: 8, file: `${INLINE_DIR}/17_Es_07_07_RG.webp` },
  ],
  8: [
    { after: 2, before: 3, file: `${INLINE_DIR}/17_Es_08_02_RG.webp` },
    { after: 3, before: 4, file: `${INLINE_DIR}/17_Es_08_03_RG.webp` },
    { after: 7, before: 8, file: `${INLINE_DIR}/17_Es_08_07_RG.webp` },
    { after: 10, before: 11, file: `${INLINE_DIR}/17_Es_08_10_RG.webp` },
    { after: 13, before: 14, file: `${INLINE_DIR}/17_Es_08_13_RG.webp` },
    { after: 15, before: 16, file: `${INLINE_DIR}/17_Es_08_15_RG.webp` },
  ],
  9: [
    { after: 5, before: 6, file: `${INLINE_DIR}/17_Es_09_05_RG.webp` },
    { after: 14, before: 15, file: `${INLINE_DIR}/17_Es_09_14_RG.webp` },
    { after: 20, before: 21, file: `${INLINE_DIR}/17_Es_09_20_RG.webp` },
    { after: 22, before: 23, file: `${INLINE_DIR}/17_Es_09_22_RG.webp` },
  ],
};

// Homepage / chapter-card cover images. Default is the first inline image
// tagged for that chapter (same default Jonah used for 3 of its 4
// chapters) — overridden per Brett's request for chapters 1 and 3, which
// use their 2nd and 3rd inline images respectively instead. The actual
// square-cropped webp files live in src/assets/chapters/covers/ (center-
// cropped from the corresponding source-assets/images/*.jpg, 800x800,
// Pillow) — this map just points at the filename, it doesn't do the
// cropping; re-crop by hand from a different source image if a cover
// choice changes again.
const COVER_IMAGES = {
  1: `${COVER_DIR}/chapter-1.webp`,
  2: `${COVER_DIR}/chapter-2.webp`,
  3: `${COVER_DIR}/chapter-3.webp`,
  4: `${COVER_DIR}/chapter-4.webp`,
  5: `${COVER_DIR}/chapter-5.webp`,
  6: `${COVER_DIR}/chapter-6.webp`,
  7: `${COVER_DIR}/chapter-7.webp`,
  8: `${COVER_DIR}/chapter-8.webp`,
  9: `${COVER_DIR}/chapter-9.webp`,
  10: `${COVER_DIR}/chapter-10.webp`,
};

// English chapter label — Esther's BSB source (unlike Jonah's RTF) DOES carry
// real \s1 section headings, so sectionTitleEn comes straight from
// parseBsbUsfm's own section field below, no editorial titles needed. Only
// the "Chapter N" label itself needs one, same "no \cl-equivalent marker"
// gap as Chinese/Hindi/Nepali.
const ENGLISH_LABELS = { 1: 'Chapter 1', 2: 'Chapter 2', 3: 'Chapter 3', 4: 'Chapter 4', 5: 'Chapter 5', 6: 'Chapter 6', 7: 'Chapter 7', 8: 'Chapter 8', 9: 'Chapter 9', 10: 'Chapter 10' };

const CHINESE_LABELS = { 1: '第一章', 2: '第二章', 3: '第三章', 4: '第四章', 5: '第五章', 6: '第六章', 7: '第七章', 8: '第八章', 9: '第九章', 10: '第十章' };

const INDIC_CHAPTER_LABELS = { 1: 'अध्याय 1', 2: 'अध्याय 2', 3: 'अध्याय 3', 4: 'अध्याय 4', 5: 'अध्याय 5', 6: 'अध्याय 6', 7: 'अध्याय 7', 8: 'अध्याय 8', 9: 'अध्याय 9', 10: 'अध्याय 10' };

// Nepali's source has no \s1 section titles at all (same gap as Jonah's
// Nepali source) — editorial titles, provisionally translated by Claude to
// match the same theme as the Hindi/English titles for each chapter; flag
// for John/Brett to confirm wording, same caveat as every other provisional
// translation in this project.
const NEPALI_TITLES = {
  1: 'वश्तीलाई रानीको पदबाट हटाइयो',
  2: 'एस्तर रानी बनाइनु',
  3: 'हामानले यहूदीहरूविरुद्ध षड्यन्त्र रच्नु',
  4: 'मोर्दकैले एस्तरलाई यहूदीहरूलाई सहायता गर्न आग्रह गर्नु',
  5: 'एस्तरले राजा र हामानका लागि भोज तयार गर्नु',
  6: 'मोर्दकैले सम्मान पाउनु',
  7: 'हामानलाई झुन्ड्याइनु',
  8: 'यहूदीहरूको प्रतिरोध',
  9: 'यहूदीहरूले आफ्ना शत्रुमाथि विजय पाउनु',
  10: 'अहासूरस र मोर्दकैका कामहरू',
};

// Dialect audio durations in seconds, read with ffprobe from the MP3s in
// public/audio (adx/bod/khg = Amdo/Central/Kham; eng = English, the BSB
// reading from biblestudytools.com/audio-bible/bsb/esther/, one file per
// chapter, already 44.1kHz mono 64kbps so copied as-is). Esther's Chinese
// cmn = Chinese (CUV), Wordproject's recording (wordproject.org/bibles/audio/
// 04_chinese/b17.htm), copied as-is (22.05kHz mono 24kbps — not re-encoded).
const DURATIONS = {
  1: { adx: 418.8, bod: 257.2, khg: 251.6, eng: 217.2, cmn: 248.8 },
  2: { adx: 471.7, bod: 289.7, khg: 277.0, eng: 243.0, cmn: 278.6 },
  3: { adx: 295.0, bod: 186.9, khg: 185.4, eng: 165.7, cmn: 197.5 },
  4: { adx: 288.7, bod: 184.7, khg: 177.5, eng: 165.7, cmn: 186.0 },
  5: { adx: 239.9, bod: 156.3, khg: 152.1, eng: 143.8, cmn: 167.2 },
  6: { adx: 259.3, bod: 171.5, khg: 164.4, eng: 142.2, cmn: 167.1 },
  7: { adx: 200.3, bod: 129.4, khg: 122.3, eng: 112.4, cmn: 138.2 },
  8: { adx: 362.7, bod: 231.5, khg: 222.9, eng: 196.8, cmn: 222.0 },
  9: { adx: 510.4, bod: 330.8, khg: 328.3, eng: 297.4, cmn: 341.2 },
  10: { adx: 57.7, bod: 40.1, khg: 37.3, eng: 33.8, cmn: 36.8 },
};

// Real bug, caught while adding Chinese chapter 1's duration (239.6s):
// rounding the leftover seconds independently of the minutes can carry a
// value of 60 (e.g. 239.6 -> 3m, round(59.6)=60 -> "3:60"). Round the total
// to the nearest second FIRST, then split into minutes/seconds, so the
// carry lands in the right place.
function fmtDuration(secs) {
  const total = Math.round(secs);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// 1. Parse the Tibetan SFM
// ---------------------------------------------------------------------------
//
// Same shape as Jonah's own Tibetan source, with one real difference: Esther's
// chapters each carry MULTIPLE \s sub-headings (scene breaks within the
// chapter), not just one — Jonah's SFM only ever had one \s per chapter, so
// its parser could get away with letting each \s simply overwrite the last.
// Here that would leave sectionTitleBo as the chapter's LAST scene instead
// of its overall theme, so this version keeps only the FIRST \s per chapter
// (matching the same "first heading wins" choice made below for English/
// Chinese/Hindi, which have the identical multi-heading-per-chapter shape).

function parseSfm(raw) {
  const lines = raw.split('\n').map((l) => l.replace(/\r$/, ''));
  const chapters = {}; // { [n]: { label, section, verses: { [v]: string[] }, paragraphStarts: Set<v> } }
  let chapterNum = null;
  let verseNum = null;
  let pendingParagraph = false; // saw \p or \m, not yet attached to the next verse
  let sawSection = {};

  const ensureChapter = (n) => {
    if (!chapters[n]) chapters[n] = { label: '', section: '', verses: {}, notes: {}, bridges: {}, paragraphStarts: new Set() };
    return chapters[n];
  };

  // Footnotes (request #35): "\f + \ft note text\f*" sits right after the word
  // it explains. Each is lifted OUT of the verse text into `notes[v]` (a plain
  // array of strings, in order of appearance) and replaced in the text by a
  // `{{fn:N}}` marker — N is the index into that verse's notes. index.astro turns
  // each marker into a † caller that opens the note in a popup; nothing is
  // left in the body text itself (no brackets). Only the Tibetan text carries
  // them: the English/Chinese/Hindi/Nepali sources' own footnotes are different
  // texts' notes and stay stripped (see their parsers). A verse can have
  // several; poetry lines (\q1) share the verse's one notes array.
  const FOOTNOTE_RE = /\\f [+\-*] ?(.*?)\\f\*/gs;
  const extractFootnotes = (s, notes) =>
    s
      .replace(FOOTNOTE_RE, (_, inner) => {
        const note = inner
          .replace(/\\fr\s+\S+\s*/g, '') // verse-reference marker, if a source ever has one
          .replace(/\\f[a-z]+\*?\s?/g, '') // \ft, \fq, \fk ... — keep their text, drop the tags
          .trim();
        notes.push(note);
        return `{{fn:${notes.length - 1}}}`;
      })
      .trim();

  for (const rawLine of lines) {
    const line = rawLine;
    if (line.startsWith('\\c ')) {
      chapterNum = parseInt(line.slice(3).trim(), 10);
      ensureChapter(chapterNum);
      verseNum = null;
      pendingParagraph = false;
      continue;
    }
    if (chapterNum === null) continue; // skip \id, \h, \mt, \imt, \is1, \ipi front matter (see parseIntroFromSfm)

    if (line.startsWith('\\cl ')) {
      chapters[chapterNum].label = line.slice(4).trim();
      continue;
    }
    if (line.startsWith('\\s ')) {
      if (!sawSection[chapterNum]) {
        chapters[chapterNum].section = line.slice(3).trim();
        sawSection[chapterNum] = true;
      }
      continue;
    }
    if (line.startsWith('\\p') || line.startsWith('\\m')) {
      pendingParagraph = true; // attach to whichever verse comes next
      continue;
    }
    if (line.startsWith('\\v ')) {
      // "\v 11-12 text" is a verse BRIDGE (Esther 8:11-12 in this source) —
      // one block of text covering two verse numbers. Keyed by its first
      // number, with the last recorded in `bridges` (buildChapter() uses it
      // to label the block "11-12" and to merge the other languages' 11+12).
      // Before bridge support this regex only matched "\v N text", so the
      // whole bridged verse's text was silently dropped.
      const m = line.match(/^\\v (\d+)(?:-(\d+))? (.*)$/s);
      if (!m) continue;
      verseNum = parseInt(m[1], 10);
      if (m[2]) chapters[chapterNum].bridges[verseNum] = parseInt(m[2], 10);
      const vnotes = [];
      const text = extractFootnotes(m[3], vnotes);
      chapters[chapterNum].verses[verseNum] = [text];
      if (vnotes.length) chapters[chapterNum].notes[verseNum] = vnotes;
      if (pendingParagraph) {
        chapters[chapterNum].paragraphStarts.add(verseNum);
        pendingParagraph = false;
      }
      continue;
    }
    if (line.startsWith('\\q1')) {
      if (verseNum === null) continue;
      const vnotes = chapters[chapterNum].notes[verseNum] ?? [];
      const text = extractFootnotes(line.replace(/^\\q1\s?/, ''), vnotes);
      if (vnotes.length) chapters[chapterNum].notes[verseNum] = vnotes;
      if (text) chapters[chapterNum].verses[verseNum].push(text);
      continue;
    }
    // ignore blank lines / anything else
  }

  return chapters;
}

// ---------------------------------------------------------------------------
// 1b. Extract the book introduction straight out of the Tibetan SFM's own
//    front matter (before the first \c marker). Unlike Jonah — where the
//    introduction arrived as a separate RTF file requiring a whole Cocoa-
//    RTF Unicode decoder — Esther's \mt/\imt/\is1/\ipi introduction is typed
//    directly into 17ESTNTB.SFM as plain UTF-8 text, so no decoding step is
//    needed at all; this is a much simpler version of the same idea. The
//    output shape ({mainTitle, introTitle, sections}) is identical to
//    Jonah's intro.json, so content.config.ts's `intro` collection schema
//    and index.astro's openIntro() rendering carry over completely
//    unchanged — only how the data gets extracted differs.
// ---------------------------------------------------------------------------

function parseIntroFromSfm(raw) {
  const lines = raw.split('\n').map((l) => l.replace(/\r$/, '').trim());
  let mainTitle = '';
  let introTitle = '';
  const sections = [];

  for (const line of lines) {
    if (line.startsWith('\\c ')) break; // front matter ends at the first chapter marker
    let m;
    if ((m = line.match(/^\\mt\s+(.*)$/))) { mainTitle = m[1]; continue; }
    if ((m = line.match(/^\\imt\s+(.*)$/))) { introTitle = m[1]; continue; }
    if ((m = line.match(/^\\is1\s+(.*)$/))) { sections.push({ heading: m[1], paragraphs: [] }); continue; }
    if ((m = line.match(/^\\ipi\s+(.*)$/))) {
      if (sections.length) sections[sections.length - 1].paragraphs.push(m[1]);
      continue;
    }
  }

  return { mainTitle, introTitle, sections };
}

// ---------------------------------------------------------------------------
// 1c. Decode the NTB Bible introduction's RTF (ported from ntb-jonah — see
//    that project's CLAUDE.md for the full "grand slam" request history).
//    Cocoa/TextEdit export: non-ASCII characters are \uc0\uNNNN Unicode
//    escapes OR \'HH cp1252 hex escapes (curly quotes, en/em dashes, and a
//    non-breaking space that genuinely appears mid-paragraph in this exact
//    file — real bug caught on ntb-jonah, fixed here from the start rather
//    than rediscovered), a literal "\" is doubled to "\\" (so the \mt/\s/\p
//    markers typed as plain text survive un-escaping), and a lone "\"
//    before a real newline is Cocoa RTF's paragraph-break shorthand.
// ---------------------------------------------------------------------------

// Windows-1252 codepoints for the 0x80-0x9F byte range, where cp1252
// diverges from Latin-1/Unicode's direct byte->codepoint mapping — needed
// for decodeIntroRtf()'s `\'HH` branch below. Bytes outside this range
// (0x00-0x7F, 0xA0-0xFF) map directly to the same-valued Unicode codepoint
// in both cp1252 and Latin-1, so only these 32 need an explicit table.
const CP1252_HIGH = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
  0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153,
  0x9e: 0x017e, 0x9f: 0x0178,
};

function decodeIntroRtf(raw) {
  // Anchor on \f0\fs<size> generically — the Bible introduction RTF uses
  // \f0\fs32 (Jonah's own book-intro RTF used \f0\fs24; matching by regex
  // rather than hardcoding one value covers either).
  const bodyMatch = raw.match(/\\f0\\fs\d+/);
  const body = bodyMatch ? raw.slice(bodyMatch.index) : raw;

  let out = '';
  let i = 0;
  while (i < body.length) {
    if (body[i] === '\\' && body[i + 1] === '\\') {
      out += '\\';
      i += 2;
      continue;
    }
    if (body[i] === '\\') {
      const rest = body.slice(i, i + 30);
      let m;
      if ((m = rest.match(/^\\uc0/))) { i += m[0].length; continue; }
      if ((m = rest.match(/^\\'([0-9a-fA-F]{2})/))) {
        const byte = parseInt(m[1], 16);
        out += String.fromCharCode(CP1252_HIGH[byte] ?? byte);
        i += m[0].length;
        continue;
      }
      if ((m = rest.match(/^\\u(-?\d+) ?/))) {
        let code = parseInt(m[1], 10);
        if (code < 0) code += 65536; // RTF encodes >32767 codepoints as signed 16-bit
        out += String.fromCharCode(code);
        i += m[0].length;
        continue;
      }
      if (body[i + 1] === '\n') { out += '\n'; i += 2; continue; }
      if (body[i + 1] === '\r' && body[i + 2] === '\n') { out += '\n'; i += 3; continue; }
      if ((m = rest.match(/^\\[a-zA-Z]+-?\d*\s?/))) { i += m[0].length; continue; } // any other stray control word
      i += 1;
      continue;
    }
    if (body[i] === '{' || body[i] === '}') { i++; continue; } // group braces (only the final closing brace appears in the body)
    out += body[i];
    i++;
  }
  return out;
}

// The Bible introduction's own marker set is simpler than Jonah's book-intro
// RTF: one \mt (this document's own title — no \imt pairing, since there's
// no separate book-name/introduction-title split here) plus \s section
// headings and \p paragraphs (not \is1/\ipi — John's own marker choice for
// this document). Per his instructions (typed into the RTF's own front
// matter): \s section titles render gold, \mt and \p text render black —
// same visual treatment openIntro() already gives the book introduction.
function parseBibleIntroRtf(raw) {
  const text = decodeIntroRtf(raw);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let title = '';
  const sections = [];

  for (const line of lines) {
    let m;
    if ((m = line.match(/^\\mt\s+(.*)$/))) { title = m[1]; continue; }
    if ((m = line.match(/^\\s\s+(.*)$/))) { sections.push({ heading: m[1], paragraphs: [] }); continue; }
    if ((m = line.match(/^\\p\s+(.*)$/))) {
      if (sections.length) sections[sections.length - 1].paragraphs.push(m[1]);
      continue;
    }
    // ignore the RTF's own front-matter lines (toggle title/placement notes
    // above the \mt line) — none of them start with a recognized marker
  }

  return { title, sections };
}

// ---------------------------------------------------------------------------
// 2. Parse the English BSB USFM (bsb2usfm-generated) — plain USFM, not RTF
//    like Jonah's English source. Multiple \v markers can share one line
//    (unlike the Tibetan SFM's one-verse-per-line convention), so verses are
//    split out of the line with a lookahead regex; text with no leading \v
//    (e.g. \li1 genealogy lines in ch. 4) is a continuation of whichever
//    verse came before it. Footnotes (\f + ...\f*) are stripped whole;
//    \r (...) cross-reference lines and \b blank/poetry-break markers carry
//    no verse text and are skipped outright. Esther's chapters each have
//    multiple \s1 sub-headings (same shape as the Tibetan \s headings
//    above) — only the first is kept per chapter, as this book's overall
//    section title.
// ---------------------------------------------------------------------------

function parseBsbUsfm(raw) {
  const chapters = {}; // { [n]: { section: string, verses: { [v]: string } } }
  let chapterNum = null;
  let verseNum = null;
  let sawSection = {};

  const ensureChapter = (n) => {
    if (!chapters[n]) chapters[n] = { section: '', verses: {}, bridges: {} };
    return chapters[n];
  };

  const stripInline = (s) =>
    s
      .replace(/\\f \+.*?\\f\*/gs, '') // footnotes — whole note dropped
      .replace(/\\ref\s.*?\\ref\*/gs, '') // stray cross-refs (shouldn't survive outside \r lines, but just in case)
      .trim();

  for (const rawLine of raw.split('\n')) {
    const line = rawLine.replace(/\r$/, '').trim();
    if (!line) continue;

    let m = line.match(/^\\c\s+(\d+)/);
    if (m) {
      chapterNum = parseInt(m[1], 10);
      ensureChapter(chapterNum);
      verseNum = null;
      continue;
    }
    if (chapterNum === null) continue; // skip \id/\usfm/\h/\toc/\mt front matter

    if (line.startsWith('\\r ')) continue; // standalone cross-reference line, not verse text
    if (line.startsWith('\\b')) continue; // blank poetry-break line

    m = line.match(/^\\s1\s+(.*)$/);
    if (m) {
      if (!sawSection[chapterNum]) {
        chapters[chapterNum].section = m[1].trim();
        sawSection[chapterNum] = true;
      }
      continue;
    }

    // \p, \li1 (genealogy list lines), \q1/\q2 (poetry) may all be followed
    // by verse markers or plain continuation text on the same line.
    let rest = line;
    let m2;
    if ((m2 = rest.match(/^\\(p|li1)\b\s*(.*)$/))) {
      rest = m2[2];
    } else if ((m2 = rest.match(/^\\(q1|q2)\b\s*(.*)$/))) {
      rest = m2[2];
    }
    if (!rest) continue; // marker-only line (e.g. bare "\p")

    // rest may contain one or more "\v N text" segments, and/or leading
    // continuation text (belongs to the PREVIOUS verse) before the first \v.
    const parts = rest.split(/(?=\\v\s+\d+)/); // a "\v 11-12" bridge still splits correctly: it starts with \v + digits
    for (const part of parts) {
      const vm = part.match(/^\\v\s+(\d+)(?:-(\d+))?\s*(.*)$/s);
      if (vm) {
        verseNum = parseInt(vm[1], 10);
        if (vm[2]) chapters[chapterNum].bridges[verseNum] = parseInt(vm[2], 10);
        const text = stripInline(vm[3]);
        chapters[chapterNum].verses[verseNum] =
          (chapters[chapterNum].verses[verseNum] ? chapters[chapterNum].verses[verseNum] + ' ' : '') + text;
      } else {
        const text = stripInline(part);
        if (text && verseNum !== null) {
          chapters[chapterNum].verses[verseNum] += ' ' + text;
        }
      }
    }
  }

  for (const c of Object.values(chapters)) {
    for (const v of Object.keys(c.verses)) {
      c.verses[v] = c.verses[v].replace(/\s+/g, ' ').trim();
    }
  }

  return chapters;
}

// ---------------------------------------------------------------------------
// 2b. Parse the Chinese CUV USFM. Same \c/\v/\p/\s1 marker shape as Jonah's
//    Chinese source, plus inline \pn...\pn* proper-name tags and \add...
//    \add* translator-supplied-word tags (both stripped, keeping the
//    enclosed text) — but UNLIKE Jonah's Chinese source, this one has real
//    footnotes (\f - \fr...\f*, note the "-" instead of Jonah's/BSB's "+").
//    Jonah's version never needed to strip footnote CONTENT (only got away
//    with generically stripping bare tags) because its source had none —
//    reused as-is here, that generic tag-stripping would have left footnote
//    explanatory text merged into the verse, so footnotes are now stripped
//    whole, first. No poetry line breaks in this source, so cmn stays a
//    plain string per verse, same as Jonah's. Multiple \s1 per chapter, same
//    "keep only the first" treatment as Tibetan/English above.
// ---------------------------------------------------------------------------

function parseCmnUsfm(raw) {
  const chapters = {}; // { [n]: { section, verses: { [v]: string } } }
  let chapterNum = null;
  let verseNum = null;
  let buf = [];
  let sawSection = {};

  const flush = () => {
    if (chapterNum !== null && verseNum !== null && buf.length) {
      chapters[chapterNum].verses[verseNum] = buf.join('').trim();
    }
    buf = [];
  };

  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    let m = line.match(/^\\c\s+(\d+)/);
    if (m) {
      flush();
      chapterNum = parseInt(m[1], 10);
      chapters[chapterNum] = { section: '', verses: {}, bridges: {} };
      verseNum = null;
      continue;
    }
    if (chapterNum === null) continue; // skip \id/\h/\toc/\mt front matter

    m = line.match(/^\\s1\s+(.*)$/);
    if (m) {
      if (!sawSection[chapterNum]) {
        chapters[chapterNum].section = m[1].trim();
        sawSection[chapterNum] = true;
      }
      continue;
    }
    m = line.match(/^\\v\s+(\d+)(?:-(\d+))?\s*(.*)$/);
    if (m) {
      flush();
      verseNum = parseInt(m[1], 10);
      if (m[2]) chapters[chapterNum].bridges[verseNum] = parseInt(m[2], 10); // verse bridge, e.g. Chinese Esther 1:13-14
      buf = [m[3]];
      continue;
    }
    if (line.startsWith('\\p') || line.startsWith('\\m')) continue;
    if (verseNum !== null) buf.push(line);
  }
  flush();

  // Strip whole footnotes first (\f followed by "+" or "-", both seen in
  // this source, through the matching \f*) — before the generic per-tag
  // stripping below, which only removes bare markers and would otherwise
  // leave a footnote's own explanatory text merged into the verse.
  // \pn/\pn*/\add/\add* (kept text, tags dropped) fall out of the same
  // generic pass. Whitespace is collapsed to nothing after, same as Jonah's
  // Chinese — meaningless in Chinese, unlike English/Tibetan word-spacing.
  for (const c of Object.values(chapters)) {
    for (const v of Object.keys(c.verses)) {
      c.verses[v] = c.verses[v]
        .replace(/\\f [+-].*?\\f\*/gs, '')
        .replace(/\\[a-zA-Z0-9]+\*?/g, '')
        .replace(/\s+/g, '');
    }
  }
  return chapters;
}

// ---------------------------------------------------------------------------
// 2c. Parse Hindi/Nepali USFM — identical to Jonah's own parseIndicUsfm.
//    Hindi's chapters carry multiple \s1 sub-headings too, so this gets the
//    same "first wins" fix as the other three languages above; Nepali's
//    source has no \s1 at all, same gap as Jonah's Nepali source (see
//    NEPALI_TITLES).
// ---------------------------------------------------------------------------

function stripIndicMarkup(s) {
  return s
    .replace(/\\f \+.*?\\f\*/gs, '') // footnotes — whole note dropped, incl. \fr/\ft/\fq content
    .replace(/\\(bdit|it)\*?/g, '') // inline emphasis tags — text kept, tags stripped
    .replace(/\s+/g, ' ')
    .trim();
}

function parseIndicUsfm(raw) {
  const chapters = {}; // { [n]: { section: string, verses: { [v]: string } } }
  let chapterNum = null;
  let verseNum = null;
  let buf = [];
  let sawSection = {};

  const flush = () => {
    if (chapterNum !== null && verseNum !== null && buf.length) {
      chapters[chapterNum].verses[verseNum] = stripIndicMarkup(buf.join(' '));
    }
    buf = [];
  };

  for (const rawLine of raw.split('\n')) {
    const line = rawLine.replace(/\r$/, '').trim();
    if (!line) continue;

    let m = line.match(/^\\c\s+(\d+)/);
    if (m) {
      flush();
      chapterNum = parseInt(m[1], 10);
      chapters[chapterNum] = { section: '', verses: {}, bridges: {} };
      verseNum = null;
      continue;
    }
    if (chapterNum === null) continue; // skip \id/\h/\toc/\mt/\is1/\ip front matter

    m = line.match(/^\\s1\s*(.*)$/);
    if (m) {
      if (!sawSection[chapterNum]) {
        chapters[chapterNum].section = m[1].trim();
        sawSection[chapterNum] = true;
      }
      continue;
    }
    m = line.match(/^\\v\s+(\d+)(?:-(\d+))?\s*(.*)$/);
    if (m) {
      flush();
      verseNum = parseInt(m[1], 10);
      if (m[2]) chapters[chapterNum].bridges[verseNum] = parseInt(m[2], 10); // verse bridge, e.g. Chinese Esther 1:13-14
      buf = [m[3]];
      continue;
    }
    m = line.match(/^\\q1\s?(.*)$/);
    if (m) {
      if (m[1] && verseNum !== null) buf.push(m[1]);
      continue;
    }
    if (line.startsWith('\\p') || line.startsWith('\\m')) continue;
    if (verseNum !== null) buf.push(line);
  }
  flush();
  return chapters;
}

// ---------------------------------------------------------------------------
// 3. Parse per-dialect verse-timing files — identical format/approach to
//    Jonah's own (see CLAUDE.md's "Verse-timing / read-along highlight").
//    adx/bod/khg came from John's forced-aligner exports, same three
//    filename conventions as Jonah (book code updated to 17_EST/17-EST).
//    eng/cmn have no such export, so their timing is generated locally
//    (scripts/english-timing/ and scripts/chinese-timing/: mlx-whisper
//    transcription + difflib alignment against this script's own parsed
//    verse text) and written to source-assets/timing/{eng,cmn}_17_EST_N.txt.
// ---------------------------------------------------------------------------

function findTimingFile(dialect, n) {
  const nn = String(n).padStart(2, '0');
  const candidates = [
    `${dialect}_17_EST_${n}.txt`,
    `${dialect}_17_EST_${nn}.txt`,
    `${dialect}-17-EST-${n}-timing.txt`,
    `${dialect}-17-EST-${nn}-timing.txt`,
  ];
  for (const name of candidates) {
    const p = path.join(TIMING_DIR, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function parseTiming(dialect, n) {
  const filePath = findTimingFile(dialect, n);
  if (!filePath) return null;

  const raw = fs.readFileSync(filePath, 'utf8');
  const verses = [];
  for (const line of raw.split('\n')) {
    const cols = line.split('\t');
    if (cols.length < 3) continue;
    const verse = parseInt(cols[2].trim(), 10);
    if (Number.isNaN(verse)) continue; // unnumbered sub-verse marker — skip
    verses.push({ verse, time: parseFloat(cols[0]) });
  }
  return verses.length ? verses : null;
}

// ---------------------------------------------------------------------------
// 4. Merge into per-chapter block lists and write JSON
// ---------------------------------------------------------------------------

function buildChapter(n, sfmChapter, bsbChapter, cmnChapter, hiChapter, neChapter) {
  const verseNums = Object.keys(sfmChapter.verses)
    .map(Number)
    .sort((a, b) => a - b);

  const images = INLINE_IMAGES[n] ?? [];
  const imageAfter = new Map(images.map((img) => [img.after, img.file]));

  // Verse BRIDGES ("\v 11-12" — Esther 8:11-12 in Tibetan and Chinese,
  // Chinese-only 1:13-14): a block is keyed by the TIBETAN verse list, and
  // covers v..end where end is the Tibetan bridge's last number (or v).
  // Every other language's text for that block is its own text for each
  // covered number, joined; a language that bridges where Tibetan doesn't
  // (Chinese 1:13-14) simply has all the text under the first number and
  // nothing under the second, which then renders as an empty verse and is
  // skipped by the app (see verseText()/hasText in index.astro). Blocks
  // whose displayed number differs from the plain verse number (the bridge
  // itself, in whichever languages cover more than one number) carry a
  // per-language `labels` entry like "11-12".
  const langs = { en: bsbChapter, cmn: cmnChapter, hi: hiChapter, ne: neChapter };
  const blocks = [];
  for (const v of verseNums) {
    const sfmEnd = sfmChapter.bridges[v] ?? v;
    const block = {
      type: 'verse',
      number: v,
      bo: sfmChapter.verses[v],
      paragraphStart: sfmChapter.paragraphStarts.has(v),
      // Footnote texts for the {{fn:N}} markers in `bo` (Tibetan only; omitted
      // when the verse has none, so most blocks are unchanged).
      ...(sfmChapter.notes[v] ? { notes: sfmChapter.notes[v] } : {}),
    };
    const labels = {};
    if (sfmEnd > v) labels.bo = `${v}-${sfmEnd}`;
    let lastCovered = sfmEnd;
    for (const [lang, ch] of Object.entries(langs)) {
      const end = Math.max(sfmEnd, ch?.bridges?.[v] ?? v);
      const parts = [];
      for (let u = v; u <= end; u++) {
        // Don't re-include a verse the Tibetan list already gives its own block
        // (Chinese 1:13-14: 14 is its own Tibetan block, shown empty in Chinese).
        if (u > sfmEnd && sfmChapter.verses[u] !== undefined) continue;
        const t = ch?.verses[u];
        if (t) parts.push(t);
      }
      block[lang] = parts.join(' ');
      if (end > v && parts.length) labels[lang] = `${v}-${end}`;
      lastCovered = Math.max(lastCovered, sfmEnd);
    }
    if (Object.keys(labels).length) block.labels = labels;
    blocks.push(block);
    for (let u = v; u <= sfmEnd; u++) {
      if (imageAfter.has(u)) blocks.push({ type: 'image', file: imageAfter.get(u) });
    }
  }

  return {
    chapterNumber: n,
    order: n,
    labelBo: sfmChapter.label,
    sectionTitleBo: sfmChapter.section,
    labelEn: ENGLISH_LABELS[n],
    sectionTitleEn: bsbChapter?.section ?? '',
    labelCmn: CHINESE_LABELS[n],
    sectionTitleCmn: cmnChapter?.section ?? '',
    labelHi: INDIC_CHAPTER_LABELS[n],
    sectionTitleHi: hiChapter?.section ?? '',
    labelNe: INDIC_CHAPTER_LABELS[n],
    sectionTitleNe: NEPALI_TITLES[n],
    cover: COVER_IMAGES[n],
    verseCount: verseNums.length,
    audio: {
      adx: `/audio/adx/chapter-${n}.mp3`,
      bod: `/audio/bod/chapter-${n}.mp3`,
      khg: `/audio/khg/chapter-${n}.mp3`,
      eng: `/audio/eng/chapter-${n}.mp3`,
      cmn: `/audio/cmn/chapter-${n}.mp3`,
    },
    duration: {
      adx: fmtDuration(DURATIONS[n].adx),
      bod: fmtDuration(DURATIONS[n].bod),
      khg: fmtDuration(DURATIONS[n].khg),
      eng: fmtDuration(DURATIONS[n].eng),
      cmn: fmtDuration(DURATIONS[n].cmn),
    },
    timing: {
      adx: parseTiming('adx', n),
      bod: parseTiming('bod', n),
      khg: parseTiming('khg', n),
      eng: parseTiming('eng', n),
      cmn: parseTiming('cmn', n),
    },
    blocks,
  };
}

function main() {
  const sfmRaw = fs.readFileSync(SFM_PATH, 'utf8');
  const bsbRaw = fs.readFileSync(BSB_USFM_PATH, 'utf8');
  const cmnRaw = fs.readFileSync(CMN_USFM_PATH, 'utf8');
  const hiRaw = fs.readFileSync(HI_USFM_PATH, 'utf8');
  const neRaw = fs.readFileSync(NE_USFM_PATH, 'utf8');

  const sfmChapters = parseSfm(sfmRaw);
  const bsbChapters = parseBsbUsfm(bsbRaw);
  const cmnChapters = parseCmnUsfm(cmnRaw);
  const hiChapters = parseIndicUsfm(hiRaw);
  const neChapters = parseIndicUsfm(neRaw);
  const intro = parseIntroFromSfm(sfmRaw);
  const bibleIntroRaw = fs.readFileSync(BIBLE_INTRO_RTF_PATH, 'latin1');
  const bibleIntro = parseBibleIntroRtf(bibleIntroRaw);
  const timeline = {
    pages: Array.from({ length: TIMELINE_PAGE_COUNT }, (_, i) => ({
      n: i + 1,
      file: `${TIMELINE_ASSET_DIR}/page-${i + 1}.webp`,
    })),
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(INTRO_OUT_DIR, { recursive: true });
  fs.mkdirSync(BIBLE_INTRO_OUT_DIR, { recursive: true });
  fs.mkdirSync(TIMELINE_OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(INTRO_OUT_DIR, 'esther.json'), JSON.stringify(intro, null, 2) + '\n');
  console.log(`intro: ${intro.sections.length} sections -> ${path.relative(ROOT, path.join(INTRO_OUT_DIR, 'esther.json'))}`);
  fs.writeFileSync(path.join(BIBLE_INTRO_OUT_DIR, 'bible-intro.json'), JSON.stringify(bibleIntro, null, 2) + '\n');
  console.log(`bible-intro: ${bibleIntro.sections.length} sections -> ${path.relative(ROOT, path.join(BIBLE_INTRO_OUT_DIR, 'bible-intro.json'))}`);
  fs.writeFileSync(path.join(TIMELINE_OUT_DIR, 'timeline.json'), JSON.stringify(timeline, null, 2) + '\n');
  console.log(`timeline: ${timeline.pages.length} pages -> ${path.relative(ROOT, path.join(TIMELINE_OUT_DIR, 'timeline.json'))}`);

  for (const n of Object.keys(sfmChapters).map(Number).sort((a, b) => a - b)) {
    const chapter = buildChapter(n, sfmChapters[n], bsbChapters[n], cmnChapters[n], hiChapters[n], neChapters[n]);
    const outPath = path.join(OUT_DIR, `chapter-${n}.json`);
    fs.writeFileSync(outPath, JSON.stringify(chapter, null, 2) + '\n');
    const timingDialects = Object.entries(chapter.timing)
      .filter(([, v]) => v)
      .map(([k]) => k);
    console.log(
      `chapter ${n}: ${chapter.verseCount} verses, ${chapter.blocks.filter((b) => b.type === 'image').length} inline images, timing: [${timingDialects.join(', ') || 'none'}] -> ${path.relative(ROOT, outPath)}`,
    );
  }
}

main();
