/**
 * scripts/translate-feature-page.js
 *
 * Usage:
 *   node scripts/translate-feature-page.js <langCode> <targetLanguageName> <nativeName>
 *
 * Example:
 *   node scripts/translate-feature-page.js hi Hindi हिन्दी
 *   → writes features-hi.html, and updates the language switcher on every
 *     page listed in LANGUAGES below (including features.html itself) so
 *     they all show the same up-to-date list of available languages.
 *
 * SETUP FOR A NEW LANGUAGE (do this every time, in order):
 *   1. Add a new entry to the LANGUAGES array below (code, name, native, file)
 *   2. Run this script with that language's code/name/native as arguments
 *   3. Open the new file in a browser, check it renders correctly
 *   4. Commit ALL changed files — the new page AND every existing page,
 *      since their switcher blocks get resynced too
 *
 * This is a manual, offline dev tool — not called by either app at runtime.
 *
 * Requires: npm install node-fetch@2 --save-dev
 */
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const BACKEND_URL = 'https://xpressable-flashcard-app-production.up.railway.app';
const SOURCE_FILE = 'features.html'; // the English source page

/**
 * The single source of truth for which languages exist and what their
 * files/native names are. Add one line here per language you translate.
 * The 'en' entry should always stay first and always exist.
 */
const LANGUAGES = [
  { code: 'en', name: 'English',    native: 'English',    file: 'features.html' },
  { code: 'es', name: 'Spanish',    native: 'Español',    file: 'features-es.html' },
  { code: 'hi', name: 'Hindi',      native: 'हिन्दी',      file: 'features-hi.html' },
  // { code: 'pt', name: 'Portuguese', native: 'Português',  file: 'features-pt.html' },
  // { code: 'fr', name: 'French',     native: 'Français',   file: 'features-fr.html' },
  // { code: 'de', name: 'German',     native: 'Deutsch',    file: 'features-de.html' },
  { code: 'bn', name: 'Bengali',    native: 'বাংলা',       file: 'features-bn.html' },
  { code: 'ur', name: 'Urdu',       native: 'اردو',        file: 'features-ur.html' },
  // { code: 'ar', name: 'Arabic',     native: 'العربية',     file: 'features-ar.html' },
  { code: 'gu', name: 'Gujarati',   native: 'ગુજરાતી',     file: 'features-gu.html' },
  { code: 'ta', name: 'Tamil',      native: 'தமிழ்',       file: 'features-ta.html' },
  { code: 'te', name: 'Telugu',     native: 'తెలుగు',      file: 'features-te.html' },
  { code: 'ml', name: 'Malayalam',  native: 'മലയാളം',     file: 'features-ml.html' },
  { code: 'kn', name: 'Kannada',    native: 'ಕನ್ನಡ',       file: 'features-kn.html' },
  // { code: 'ja', name: 'Japanese',   native: '日本語',       file: 'features-ja.html' },
  // { code: 'ko', name: 'Korean',     native: '한국어',       file: 'features-ko.html' },
  // { code: 'zh', name: 'Chinese',    native: '中文',         file: 'features-zh.html' },
];

function buildSwitcherBlock(currentCode) {
  const options = LANGUAGES.map((l) =>
    `          <option value="${l.file}"${l.code === currentCode ? ' selected' : ''}>${l.native}</option>`
  ).join('\n');
  return [
    '      <!-- LANG-SWITCHER-START -->',
    '      <div class="lang-switcher-wrap" title="Change language">',
    '        <span class="lang-switcher-icon" aria-hidden="true">🌐</span>',
    '        <select class="lang-switcher" onchange="if(this.value) window.location.href=this.value;" aria-label="Change language">',
    options,
    '        </select>',
    '      </div>',
    '      <!-- LANG-SWITCHER-END -->',
  ].join('\n');
}

function injectSwitcher(html, currentCode) {
  const marker = /      <!-- LANG-SWITCHER-START -->[\s\S]*?<!-- LANG-SWITCHER-END -->/;
  if (!marker.test(html)) {
    console.warn(`  ! LANG-SWITCHER markers not found — skipping switcher injection for this file.`);
    return html;
  }
  return html.replace(marker, buildSwitcherBlock(currentCode));
}

async function translate(html, targetLanguage) {
  const response = await fetch(`${BACKEND_URL}/api/translate-page`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, targetLanguage }),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const { translatedHtml } = await response.json();
  if (!translatedHtml) throw new Error('No translated content returned - check Railway logs.');
  return translatedHtml;
}

async function main() {
  const [langCode, targetLanguage, nativeName] = process.argv.slice(2);
  if (!langCode || !targetLanguage || !nativeName) {
    console.error('Usage: node scripts/translate-feature-page.js <langCode> <targetLanguageName> <nativeName>');
    console.error('Example: node scripts/translate-feature-page.js hi Hindi हिन्दी');
    process.exit(1);
  }

  const entry = LANGUAGES.find((l) => l.code === langCode);
  if (!entry) {
    console.error(`"${langCode}" isn't in the LANGUAGES array yet. Add it there first:`);
    console.error(`  { code: '${langCode}', name: '${targetLanguage}', native: '${nativeName}', file: 'features-${langCode}.html' },`);
    process.exit(1);
  }

  const sourcePath = path.resolve(SOURCE_FILE);
  const sourceHtml = fs.readFileSync(sourcePath, 'utf-8');

  if (langCode !== 'en') {
    console.log(`Translating ${SOURCE_FILE} -> ${targetLanguage} (${langCode})... this can take 30-60s.`);
    const translated = await translate(sourceHtml, targetLanguage);
    const withLang = translated.replace(/<html lang="en">/, `<html lang="${langCode}">`);
    const withSwitcher = injectSwitcher(withLang, langCode);
    const outputPath = path.join(path.dirname(sourcePath), entry.file);
    fs.writeFileSync(outputPath, withSwitcher, 'utf-8');
    console.log(`Wrote ${entry.file}`);
  }

  // Resync the switcher block on every OTHER known page, including the
  // English source, so they all show the current full language list.
  console.log('Resyncing language switcher across all known pages...');
  for (const lang of LANGUAGES) {
    const filePath = path.join(path.dirname(sourcePath), lang.file);
    if (!fs.existsSync(filePath)) {
      console.log(`  - ${lang.file} doesn't exist yet, skipping.`);
      continue;
    }
    const html = fs.readFileSync(filePath, 'utf-8');
    const updated = injectSwitcher(html, lang.code);
    if (updated !== html) {
      fs.writeFileSync(filePath, updated, 'utf-8');
      console.log(`  - Updated switcher in ${lang.file}`);
    } else {
      console.log(`  - ${lang.file} unchanged`);
    }
  }

  console.log('\nDone. Open the new/changed files in a browser to confirm they render correctly before committing.');
}

main().catch((err) => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
