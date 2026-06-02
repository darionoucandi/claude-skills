#!/usr/bin/env node
/**
 * Static linter for ABlyft variation files (Custom JS + Custom CSS) on Shopify.
 * Dev-time only — NOT shipped to production or ABlyft.
 *
 * This skill has no test folder, so the usual flow is:
 *   1. Save the user's pasted code to files (e.g. variation.js, variation.css)
 *   2. Validate explicit paths:
 *        node scripts/validate-experiment.mjs variation.js variation.css
 *
 * With no paths, it scans the current directory and one level of subfolders
 * for any *.js / *.css files.
 *
 * Enforces the rules from SKILL.md. Opt out per-file with:
 *   // @ab-test-allow mutation-observer
 *   // @ab-test-allow inner-text
 *   // @ab-test-allow logging
 */

import fs from 'fs';
import path from 'path';

const SCAN_ROOT = process.cwd();

const errors = [];
const warnings = [];

function rel(filePath) {
  return path.relative(SCAN_ROOT, filePath).replace(/\\/g, '/') || filePath;
}

/** Opt-in suppressions, e.g. // @ab-test-allow mutation-observer */
function getAllowList(code) {
  const allowed = new Set();
  const re = /@ab-test-allow[:\s]+([\w-]+)/g;
  let m;
  while ((m = re.exec(code)) !== null) allowed.add(m[1]);
  return allowed;
}

function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

/** Resolve targets: explicit paths, or scan cwd + one level deep for .js/.css. */
function findFiles(paths) {
  if (paths.length > 0) {
    return paths.map((p) =>
      path.isAbsolute(p) ? p : path.join(SCAN_ROOT, p)
    );
  }

  const found = [];
  const isCode = (n) => n.endsWith('.js') || n.endsWith('.mjs') || n.endsWith('.css');

  for (const entry of fs.readdirSync(SCAN_ROOT, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(SCAN_ROOT, entry.name);
    if (entry.isFile() && isCode(entry.name)) {
      found.push(full);
    } else if (entry.isDirectory()) {
      for (const sub of fs.readdirSync(full, { withFileTypes: true })) {
        if (sub.isFile() && isCode(sub.name)) found.push(path.join(full, sub.name));
      }
    }
  }
  return found;
}

function push(list, file, ruleId, message) {
  list.push({ file: rel(file), ruleId, message });
}

function validateJs(file, code) {
  const stripped = stripComments(code);
  const allow = getAllowList(code);

  if (!/^\s*\(function\s*\(/.test(stripped) && !/^\s*\(\s*\(\s*\)\s*=>/.test(stripped)) {
    push(errors, file, 'js/iife', 'Wrap all variation logic in an IIFE: (function () { ... })();');
  }

  if (!/'use strict'/.test(code) && !/"use strict"/.test(code)) {
    push(errors, file, 'js/strict', "Include 'use strict' inside the IIFE.");
  }

  if (
    /\[id\^=\s*['"]shopify-section-(?!template)/.test(code) ||
    /querySelectorAll\s*\(\s*['"]\[id\^=['"]shopify-section-['"]\s*['"]\s*\)/.test(code)
  ) {
    push(
      errors,
      file,
      'js/shopify-scope',
      'Do not query all [id^="shopify-section-"] on the page. Scope to shopify-section-template--<PRODUCT_ID>__<TYPE>_ (use getSectionTypePrefix).'
    );
  }

  if (/\.section-template--/.test(code)) {
    push(
      errors,
      file,
      'js/shopify-selector',
      'Invalid selector ".section-template--*". Shopify section IDs use #shopify-section-template--...'
    );
  }

  if (/new\s+MutationObserver/.test(code) && !allow.has('mutation-observer')) {
    push(
      warnings,
      file,
      'js/mutation-observer',
      'Prefer ablyftTools.waitForElement over a custom MutationObserver. To acknowledge legacy code: // @ab-test-allow mutation-observer'
    );
  }

  if (/\.innerText/.test(code) && !allow.has('inner-text')) {
    push(
      warnings,
      file,
      'js/inner-text',
      'Prefer textContent over innerText for copy checks (avoids reflow). Or: // @ab-test-allow inner-text'
    );
  }

  const usesAntiFlicker =
    /document\.documentElement\.style\.visibility\s*=\s*['"]hidden['"]/.test(code);

  const hasSafeReveal =
    /\bfinally\s*\{/.test(code) ||
    /setTimeout\s*\(\s*(?:function|\(\)|[^)]*=>)[^}]*(?:revealPage|visibility\s*=\s*['"]visible['"])/.test(
      code
    );

  if (usesAntiFlicker && !hasSafeReveal) {
    push(
      errors,
      file,
      'js/anti-flicker-reveal',
      'Anti-flicker (visibility:hidden on <html>) must reveal via try/finally or a safety setTimeout that restores visibility.'
    );
  }

  // Any namespaced bracket prefix counts, e.g. [A/B Test], [My Exp], or a LOG_PREFIX const.
  const hasNamespacedLog = /LOG_PREFIX/.test(code) || /\[[^\]]+\]/.test(code);

  if (
    !allow.has('logging') &&
    !hasNamespacedLog &&
    /console\.(log|warn|error)/.test(code)
  ) {
    push(
      warnings,
      file,
      'js/logging',
      'Use a namespaced LOG_PREFIX for console output (e.g. [A/B Test]). Or: // @ab-test-allow logging'
    );
  }

  if (
    /document\.(body|documentElement)\.style/.test(code) &&
    !usesAntiFlicker &&
    /display\s*[:=]/.test(code)
  ) {
    push(
      warnings,
      file,
      'js/global-style',
      'Avoid changing body/html display globally; target experiment selectors only.'
    );
  }
}

function validateCss(file, code) {
  const stripped = stripComments(code);

  if (/\.section-template--/.test(stripped)) {
    push(
      errors,
      file,
      'css/shopify-selector',
      'Invalid ".section-template--*". Use [id^="shopify-section-template--..."] or #shopify-section-template--...'
    );
  }

  if (/(?:^|[,{]\s*)(?:html|body)\s*\{[^}]*display\s*:\s*none/i.test(stripped)) {
    push(
      errors,
      file,
      'css/global-hide',
      'Do not hide html/body with display:none. Scope hides to section selectors.'
    );
  }
}

function validateFile(filePath) {
  if (!fs.existsSync(filePath)) {
    push(errors, filePath, 'file/missing', 'File not found.');
    return;
  }
  const code = fs.readFileSync(filePath, 'utf8');
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) validateJs(filePath, code);
  else if (filePath.endsWith('.css')) validateCss(filePath, code);
}

function printResults(list, label) {
  if (list.length === 0) return;
  console.log(`\n${label} (${list.length}):\n`);
  for (const item of list) {
    console.log(`  [${item.ruleId}] ${item.file}`);
    console.log(`    ${item.message}\n`);
  }
}

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const paths = args.filter((a) => !a.startsWith('--'));

const targets = findFiles(paths);

if (targets.length === 0) {
  console.log('No .js / .css files found. Pass explicit paths, e.g.:');
  console.log('  node scripts/validate-experiment.mjs variation.js variation.css\n');
  process.exit(0);
}

for (const file of targets) validateFile(file);

printResults(errors, 'ERRORS');
printResults(warnings, 'WARNINGS');

if (errors.length > 0) {
  console.log('Failed: fix ERRORS before shipping to ABlyft.\n');
  process.exit(1);
}

if (strict && warnings.length > 0) {
  console.log('Failed (--strict): resolve WARNINGS.\n');
  process.exit(1);
}

console.log(warnings.length > 0 ? 'Passed with warnings.\n' : 'All checks passed.\n');
process.exit(0);
