# shopify-ablyft-experiments

Claude Code plugin for writing, reviewing, and QA of **ABlyft variation code** (Custom JS + Custom CSS) on **Shopify Online Store 2.0** storefronts.

## Skill

| Skill | Purpose |
|-------|---------|
| `shopify-ablyft-experiments` | Author/review variation JS/CSS, target Shopify sections, anti-flicker, `ablyftTools`, QA checklist |

Invoke after install:

```text
/shopify-ablyft-experiments:shopify-ablyft-experiments
```

## Bundled resources

- `skills/shopify-ablyft-experiments/SKILL.md` — main skill instructions
- `skills/shopify-ablyft-experiments/shopify-selectors.md` — Shopify section ID recipes
- `skills/shopify-ablyft-experiments/scripts/validate-experiment.mjs` — static variation-code validator

Validate pasted variation files:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/shopify-ablyft-experiments/scripts/validate-experiment.mjs" variation.js variation.css
```
