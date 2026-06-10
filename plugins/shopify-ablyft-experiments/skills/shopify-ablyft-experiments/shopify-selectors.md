# Shopify selectors (ABlyft A/B tests)

Reference for PDP/PLP/collection experiments on **Shopify Online Store 2.0**.

> Throughout, replace `<PRODUCT_ID>`, `<SECTION_TYPE>`, and `<LABEL>` with the real values from the DOM the user pasted. Never hardcode a random suffix.

## Section ID anatomy

```
shopify-section-template--29669728682309__layout_6DXbiF
│                      │              │         │    └── random suffix (volatile)
│                      │              │         └─────── section type (stable)
│                      │              └───────────────── product / template instance id
└──────────────────────┴────────────────────────────── always this prefix
```

HTML:

```html
<section id="shopify-section-template--<PRODUCT_ID>__layout_6DXbiF"
         class="shopify-section shopify-section--layout">
```

The theme editor may also expose a **class** variant: `.shopify-section--<type>` (hyphens, no random suffix). Prefer `[id^=...]` when multiple instances of the same type exist on the page.

## Which section types are safe to match by prefix only?

| Section type | Prefix-only safe? | Why |
|--------------|-------------------|-----|
| Custom landing-page section (e.g. `lp_info_boxes`) | Often yes | Usually one per page |
| `rich_text` | No | Use `:has([aria-label="..."])` or text in JS |
| `layout` | No | Multiple layouts per template |
| `content_with_image` | No | Common block, multiple instances |
| `image_banner` | No | Hero + promo banners — exclude hero via markers |

Always verify count in DevTools before relying on prefix-only.

## CSS recipes

**Unique section type:**

```css
[id^="shopify-section-template--<PRODUCT_ID>__<SECTION_TYPE>_"] {
  display: none !important;
}
```

**Generic type + attribute:**

```css
[id^="shopify-section-template--<PRODUCT_ID>__rich_text_"]:has([aria-label="<LABEL>"]) {
  display: none !important;
}
```

Case-insensitive contains (modern browsers):

```css
[id^="shopify-section-template--<PRODUCT_ID>__rich_text_"]:has([aria-label*="<LABEL>" i]) {
  display: none !important;
}
```

## JS recipes

**Derive type prefix from a known full id (provided by the user):**

```js
function getSectionTypePrefix(fullId) {
  const i = fullId.lastIndexOf('_');
  return i > 0 ? fullId.slice(0, i + 1) : fullId;
}

// "shopify-section-template--<PRODUCT_ID>__layout_6DXbiF"
// → "shopify-section-template--<PRODUCT_ID>__layout_"
```

**Hide by text within scoped sections:**

```js
function hideByTextInScope(typePrefix, anchor, label, logPrefix) {
  const sel = `[id^="${typePrefix}"]`;
  let n = 0;
  document.querySelectorAll(sel).forEach((section) => {
    if ((section.textContent || '').includes(anchor)) {
      section.style.setProperty('display', 'none', 'important');
      n++;
      console.log(`${logPrefix} Hidden: ${label} (#${section.id})`);
    }
  });
  if (n === 0) console.error(`${logPrefix} No match for "${anchor}" in ${sel}`);
  if (n > 1) console.warn(`${logPrefix} Multiple matches (${n}) for ${label}`);
}
```

**Non-hero image banner (exclude hero via markers from the brief):**

```js
const HERO_MARKERS = ['<HERO_TEXT_1>', '<HERO_TEXT_2>'];

function isHeroBanner(el) {
  const t = el.textContent || '';
  const h = el.innerHTML || '';
  return HERO_MARKERS.some((m) => t.includes(m) || h.includes(m));
}

document
  .querySelectorAll('[id^="shopify-section-template--<PRODUCT_ID>__image_banner_"]')
  .forEach((banner) => {
    if (!isHeroBanner(banner)) {
      banner.style.setProperty('display', 'none', 'important');
    }
  });
```

## Hybrid split (recommended for hide-section tests)

| Target | Layer |
|--------|-------|
| Unique custom section | CSS prefix |
| `rich_text` + specific button | CSS `:has([aria-label])` |
| `layout`, `content_with_image`, non-hero `image_banner` | JS text / hero logic + anti-flicker |

## DevTools verification (give this to the user)

```js
const checks = [
  ['unique section', '[id^="shopify-section-template--<PRODUCT_ID>__<SECTION_TYPE>_"]'],
  ['rich_text btn',  '[id^="shopify-section-template--<PRODUCT_ID>__rich_text_"]:has([aria-label="<LABEL>"])'],
  ['layout',         '[id^="shopify-section-template--<PRODUCT_ID>__layout_"]'],
];
checks.forEach(([name, sel]) =>
  console.log(name, document.querySelectorAll(sel).length)
);
```

Expect `1` for each intended target (warn if `0` or `>1`).

## When the theme team can help

Ask for stable hooks on ambiguous sections:

```liquid
<section class="shopify-section" data-ab-section="<STABLE_NAME>">
```

Then CSS:

```css
[data-ab-section="<STABLE_NAME>"] {
  display: none !important;
}
```

No JS, no suffix dependency, no copy-string dependency.
