---
name: shopify-ablyft-experiments
description: >-
  Build, review, and QA ABlyft A/B test variation code (JS + CSS) for Shopify
  Online Store 2.0 storefronts. Use whenever creating or editing experiment
  variation scripts, hiding/showing/moving sections, targeting Shopify section
  IDs, handling anti-flicker (FOUC), using ablyftTools/selectors, or reviewing
  A/B test quality. This skill has no test folder available, so it asks the user
  to paste the test's existing JS/CSS and brief before writing or reviewing code.
---

# Shopify ABlyft Experiments

Reference for building and reviewing **ABlyft A/B test variation code** (Custom JS + Custom CSS slots) on **Shopify Online Store 2.0** storefronts. Combines [ablyftTools docs](https://docs.ablyft.com/experiments/ablyfttools), proven Shopify section-targeting patterns, and lessons from shipped tests.

This skill is **self-contained and project-agnostic**: it does not assume any repository, test folder, or saved HTML. All test-specific input comes from the user.

---

## Step 0 — Gather inputs from the user (do this first)

There is **no test folder or saved HTML** available to this skill. Before writing or reviewing any code, ask the user for what you need. Do **not** invent identifiers, product IDs, selectors, or experiment slugs.

Ask for whichever of these apply to the task:

1. **The brief** — what should the variation do? (hide/show/move a section, change copy, restyle, inject UI, etc.)
2. **Existing variation code** — paste the current **Custom JS** and **Custom CSS** of the test (if editing or reviewing). If creating from scratch, say so.
3. **Real DOM evidence** — paste the relevant HTML snippet from the live/staging page (e.g. the `<section id="shopify-section-template--...">` you want to target), or the output of a `document.querySelectorAll(...)` check in DevTools.
4. **Stable anchors** — section `id`(s), product/template id, `aria-label`s, stable copy strings, `data-*` hooks.
5. **Page type & activation** — PDP / PLP / cart / collection; standard page load or SPA / client router.
6. **Naming** — any existing `LOG_PREFIX`, experiment slug, or namespace they want used. If none, propose a generic one (e.g. `[A/B Test]`).

If the user can only give partial info, work from what they provide and flag the assumptions you had to make. Never hardcode a Shopify random suffix or a product id the user did not give you.

---

## Workflow

```
1. Ask for inputs (Step 0)            → brief + existing JS/CSS + real selectors
2. Decide CSS vs JS                    → see decision tree
3. Write / edit variation code        → use templates below, real selectors only
4. Add anti-flicker if JS runs late    → reveal in finally
5. Self-review against best practices  → optionally run the validator
6. Hand off with a QA checklist        → preview-mode QA steps for the user
```

---

## ablyftTools (use instead of a custom MutationObserver)

Available wherever the ABlyft snippet loaded. Access:

```js
const ablyftTools = window.ablyft.getTools();
```

Official helpers: [ablyftTools / Helper Functions](https://docs.ablyft.com/experiments/ablyfttools)

| Helper | Use when | Do NOT use for |
|--------|----------|----------------|
| **`waitForElement(selector, cb)`** | Target appears on load **or** later (AJAX, apps, lazy UI). MutationObserver built-in. Callback receives a **NodeList-like collection** (`querySelectorAll` result) — iterate, don't assume a single node. | Scanning all sections of a type — use `querySelectorAll` inside `run()` after DOM ready |
| **`elementIsInView(selector, cb [, repeat])`** | Scroll-triggered logic, impression-style behavior. IntersectionObserver. Third arg `true` = fire every time. | Hiding elements, one-shot page setup |
| **`domChanged(cb)`** | SPA / DOM injected after navigation; re-run logic when tree changes | One-shot init only (fires on **every** mutation — guard with flags or debounce) |
| **`checkForDataLayerEntry(pairs, cb)`** | Wait for GA4/GTM `dataLayer` entry before activating | Generic element waits |

### DOM ready: what to use

| Scenario | Recommended |
|----------|-------------|
| **Shopify PDP/PLP** (server-rendered sections in initial HTML) | Run once when DOM is ready: `document.readyState !== 'loading'` → run immediately, else `DOMContentLoaded`. |
| **Element may not exist yet** | `ablyftTools.waitForElement(selector, callback)` |
| **SPA / client router** | Project activation **On DOM Change** or **On URL Change** ([SPA testing](https://docs.ablyft.com/projects/single-page-application-spa-testing)) + `domChanged` or `window.ablyft.reInit()` on route change (`reInit` is part of the SPA API). |
| **Custom `MutationObserver` / `setInterval` polling** | Avoid for new tests — use `waitForElement`. |

**Note:** the Ablyft Code Helper UI may show `domLoaded` / `elementInView`. Official API names are `domChanged` and `elementIsInView`. If `domLoaded` exists in the editor runtime, verify in preview console; otherwise use `DOMContentLoaded` or `waitForElement`.

---

## CSS vs JS decision tree

```
Need to hide/show/move content?
│
├─ Can target uniquely with CSS (stable id prefix, :has([aria-label]), unique section type)?
│  └─ YES → Custom CSS only (injected early = no flicker)
│
├─ Only free-text copy distinguishes sections?
│  └─ YES → JS with scoped text match (see Shopify patterns)
│
└─ DOM changes after load / carousel / app block?
   └─ JS + ablyftTools.waitForElement
```

**Rule:** Prefer CSS for `display`/`visibility`. Use JS for text disambiguation, hero-vs-non-hero logic, and dynamic inserts.

---

## Anti-flicker (FOUC)

When JS runs **after** first paint, users may flash control content.

**Pattern:** at the top of the IIFE, before any async wait:

```js
document.documentElement.style.visibility = 'hidden';
```

Reveal in `finally` after variant logic:

```js
function revealPage() {
  if (document.documentElement.style.visibility === 'hidden') {
    document.documentElement.style.visibility = 'visible';
  }
}
```

- Use `visibility: hidden` on `<html>`, not `display: none` (avoids layout jump on reveal).
- Wrap main logic in `try/catch/finally` so reveal always runs.
- CSS-only hides do **not** need this if ABlyft injects the CSS in `<head>` before paint.
- Optional safety net: `setTimeout(revealPage, 3000)` in case a callback never fires.

---

## JavaScript template

Use the user's config/prefix names when provided. Do not add an invented `TEST_ID` unless the brief includes one.

```js
(function () {
  'use strict';

  const LOG_PREFIX = '[A/B Test]'; // or user-provided prefix

  // Anti-flicker only if JS must run before the user should see the page
  document.documentElement.style.visibility = 'hidden';

  function revealPage() {
    if (document.documentElement.style.visibility === 'hidden') {
      document.documentElement.style.visibility = 'visible';
    }
  }

  function run() {
    try {
      // variant logic
    } catch (e) {
      console.error(`${LOG_PREFIX} Unexpected error:`, e);
    } finally {
      revealPage();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
```

For late elements:

```js
const ablyftTools = window.ablyft.getTools();

ablyftTools.waitForElement('.product-gallery', (els) => {
  // els is a NodeList-like collection (querySelectorAll result), not a single node
  els.forEach((el) => {
    // per-element logic
  });
});
```

---

## Shopify section targeting

See [shopify-selectors.md](shopify-selectors.md) for full anatomy and copy-paste recipes.

**Quick rules** (replace `<PRODUCT_ID>` and `<SECTION_TYPE>` with values from the user's DOM):

| Part of id | Stable? | Example |
|------------|---------|---------|
| `shopify-section-template--<PRODUCT_ID>__` | Yes (per product/template) | `...29669728682309__` |
| Section type (`layout`, `rich_text`, `image_banner`…) | Yes | `layout_` |
| Random suffix (e.g. `6DXbiF`) | **No** (regenerated in theme editor) | avoid hardcoding |

**CSS, suffix-agnostic:**

```css
[id^="shopify-section-template--<PRODUCT_ID>__<SECTION_TYPE>_"] {
  display: none !important;
}

[id^="shopify-section-template--<PRODUCT_ID>__rich_text_"]:has([aria-label="<LABEL>"]) {
  display: none !important;
}
```

**JS fallback scoped to section type** (never `[id^='shopify-section-']` on the whole page):

```js
function getSectionTypePrefix(fullId) {
  const i = fullId.lastIndexOf('_');
  return i > 0 ? fullId.slice(0, i + 1) : fullId;
}

// fullId comes from a real id the user provided
const candidates = document.querySelectorAll(`[id^="${getSectionTypePrefix(fullId)}"]`);
```

**Text checks:** use `textContent`, not `innerText` (no forced reflow). Use `innerHTML` only when matching markup attributes is intentional.

**Verify in console (give this to the user):**

```js
document.querySelectorAll('[id^="shopify-section-template--<PRODUCT_ID>__<SECTION_TYPE>_"]').length
// expect 1 per target
```

---

## Best practices

### Selectors & scope

- Prefer `#id` > `[id^=prefix]` > `.class` > tag; use `[data-testid]`, `aria-label`, `:has()` when available.
- Namespace injected UI with a class derived from the brief (e.g. `.ab-test-<slug>`).
- Avoid generic selectors (`div`, `.container`, `h2`) and broad descendant chains.
- Never scan the whole page with `[id^='shopify-section-']` for fallbacks — scope to product + section type.
- Cache `querySelector` / `querySelectorAll` results in loops.

### Styles

- Do not permanently change `body`, `html`, `*`, or layout-critical theme classes.
- Inject CSS under the experiment scope when adding new UI.
- Prefer specific selectors over `!important`; use `display: none !important` when the theme already uses `!important`.
- **Exception:** temporary `document.documentElement.style.visibility = 'hidden'` for JS anti-flicker only; always reveal in `finally`.

### Waiting for DOM

- **Do not** add a custom `MutationObserver` or `setInterval` polling in new tests — use `ablyftTools.waitForElement`.
- Shopify server-rendered pages: one-shot `DOMContentLoaded` / `readyState` is enough for sections in the initial HTML.
- Late/async nodes (apps, carousels): `waitForElement`.
- SPA: project activation On DOM Change / On URL Change + `domChanged` or `window.ablyft.reInit()`; guard `domChanged` with flags/debounce (fires on every mutation).

### Site integrity

- Do not remove or override native listeners unless required; if overridden, restore behavior in variant logic.
- Stay inside variant scope — do not touch unrelated tabs, carousels, modals, or forms.
- Do not depend on third-party scripts unless loaded and required; prefer `checkForDataLayerEntry` for GTM-driven activation.

### JavaScript safety

- Wrap in IIFE + `'use strict'`; no globals except one namespaced cleanup: `window.<slug>_cleanup`.
- Do not modify prototypes or unrelated `window` APIs.
- `try/catch/finally` on main run; namespaced `console` only — never break the control experience if the test throws.
- Short, focused functions; **CSS before JS** when both can achieve the goal.

### Performance & memory

- Batch DOM writes; use `requestAnimationFrame` for grouped visual updates.
- Use `textContent` for text checks, not `innerText`.
- In cleanup: remove listeners, clear timeouts/intervals, disconnect any observers, restore inline styles.

### Tracking

- Namespace test events (e.g. `ab-test-<slug>_click`); do not alter core GA4 / `dataLayer` without analytics sign-off.
- Use `ablyftTools.checkForDataLayerEntry` when goals depend on a specific dataLayer push.
- Shopify goals: see [Tracking in Shopify overview](https://docs.ablyft.com/goals/tracking-in-shopify-overview).

---

## Cleanup (preview / variant switch)

Expose a restore function for ABlyft preview:

```js
window.myExperiment_cleanup = function () {
  // remove injected nodes, restore styles, remove listeners
};
```

Store original inline `style` before overwriting if hiding via JS.

---

## Validate variation code (optional, before handoff)

A static checker is bundled for environments that can run Node. Because there is no test folder, **save the user's JS/CSS to files first**, then pass the paths explicitly:

```bash
# Save the pasted code, then validate explicit files:
node scripts/validate-experiment.mjs path/to/variation.js path/to/variation.css
```

If no paths are given, it scans the current directory (and one level of subfolders) for `.js` / `.css` files.

| Flag | Behavior |
|------|----------|
| (default) | Exit **1** on ERRORS; WARNINGS allowed |
| `--strict` | Exit **1** on WARNINGS too |

### What it enforces

| ID | Severity | Rule |
|----|----------|------|
| `js/iife` | ERROR | Variation JS wrapped in `(function () { ... })();` |
| `js/strict` | ERROR | `'use strict'` present |
| `js/shopify-scope` | ERROR | No page-wide `[id^="shopify-section-"]` (must use `shopify-section-template--...`) |
| `js/shopify-selector` | ERROR | No `.section-template--` (wrong Shopify selector) |
| `css/shopify-selector` | ERROR | Same for CSS |
| `css/global-hide` | ERROR | No `html, body { display: none }` |
| `js/anti-flicker-reveal` | ERROR | If `visibility:hidden` on `<html>`, must use `finally` or safety `setTimeout` reveal |
| `js/mutation-observer` | WARN | No custom `MutationObserver` |
| `js/inner-text` | WARN | Prefer `textContent` over `innerText` |
| `js/logging` | WARN | Namespaced console prefix |
| `js/global-style` | WARN | No global `body`/`html` display changes outside anti-flicker |

**Opt-out in a file** (only when intentionally keeping legacy code):

```js
// @ab-test-allow mutation-observer
// @ab-test-allow inner-text
// @ab-test-allow logging
```

If running Node isn't possible (e.g. plain chat), review the code against the table above manually — the rules are the same.

---

## QA checklist (hand to the user)

- [ ] Validator passes (no ERRORS), or manual review against the rules table done
- [ ] Preview mode: correct environment, URL, variation ([docs](https://docs.ablyft.com/experiments/preview-mode-perform-quality-assurance))
- [ ] Desktop + tablet + mobile; Slow 3G — no flicker, no layout shift
- [ ] Safari + Chrome (iOS/Android differences)
- [ ] Console: each target logs once; no failure logs
- [ ] Control variant unchanged
- [ ] Note any selectors that rely on volatile Shopify suffixes (document for handoff)

---

## Common mistakes (avoid)

| Mistake | Fix |
|---------|-----|
| Fallback `querySelectorAll("[id^='shopify-section-']")` | Scope to `getSectionTypePrefix(fullId)` |
| Invented `TEST_ID` / product id / suffix | Use only identifiers the user provided |
| All-hide in JS when CSS `:has()` works | Split CSS (early) + JS (text-only) |
| Custom `MutationObserver` in new tests | `ablyftTools.waitForElement` |
| `innerText` for anchors | `textContent` |
| `.section-template--...` class selector | IDs use `#shopify-section-template--...` |
| No `try/finally` with anti-flicker | Always `revealPage()` in `finally` |
| Globals leaking | IIFE + `'use strict'` |
| Inline-style anchor `p[style*="font-size: 10px"]` | Stable class + combinator (`.information__description + p`), `[data-*]`, `aria-label`, or text match |

---

## Additional resources

- [shopify-selectors.md](shopify-selectors.md) — Shopify section IDs, CSS/JS recipes
- [scripts/validate-experiment.mjs](scripts/validate-experiment.mjs) — static variation-code validator
- [ablyftTools](https://docs.ablyft.com/experiments/ablyfttools)
- [SPA testing / activation modes](https://docs.ablyft.com/projects/single-page-application-spa-testing)
- [Preview / QA](https://docs.ablyft.com/experiments/preview-mode-perform-quality-assurance)
