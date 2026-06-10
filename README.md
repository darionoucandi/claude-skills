# claude-skills

Central marketplace for shared **Claude Code** plugins and skills. Follows the [Anthropic plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces) layout.

## Structure

```text
.claude-plugin/marketplace.json     # catalog of all team plugins
plugins/
└── <plugin-name>/
    ├── .claude-plugin/plugin.json  # plugin manifest
    ├── README.md                   # plugin docs
    └── skills/<skill-name>/
        └── SKILL.md                # skill definition (+ optional scripts, references)
```

## Install for developers

Requires access to this repository (private or public) and [Claude Code](https://code.claude.com/docs/en/overview).

### 1. Add the marketplace

In Claude Code:

```text
/plugin marketplace add darionoucandi/claude-skills
```

Or from a local clone during development:

```text
/plugin marketplace add ./path/to/claude-skills
```

CLI equivalent:

```bash
claude plugin marketplace add darionoucandi/claude-skills
```

### 2. Install a plugin

```text
/plugin install shopify-ablyft-experiments@claude-skills
```

CLI equivalent:

```bash
claude plugin install shopify-ablyft-experiments@claude-skills
```

### 3. Use a skill

Plugin skills are namespaced as `plugin-name:skill-name`:

```text
/shopify-ablyft-experiments:shopify-ablyft-experiments
```

### 4. Update after changes

```text
/plugin marketplace update claude-skills
```

## Team auto-install (optional)

To prompt collaborators when they trust this repo, add to the project `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "claude-skills": {
      "source": {
        "source": "github",
        "repo": "darionoucandi/claude-skills"
      }
    }
  }
}
```

## Available plugins

| Plugin | Description |
|--------|-------------|
| [shopify-ablyft-experiments](plugins/shopify-ablyft-experiments/) | ABlyft variation JS/CSS for Shopify OS 2.0 — write, review, QA |

## Adding a new skill

1. Create `plugins/<plugin-name>/` with `.claude-plugin/plugin.json` and `skills/<skill-name>/SKILL.md`.
2. Register the plugin in `.claude-plugin/marketplace.json`.
3. Bump `version` in both `plugin.json` and the marketplace entry when releasing.
4. Validate locally:

```bash
claude plugin validate .
claude plugin validate ./plugins/<plugin-name>
```

## License

MIT — see [LICENSE](LICENSE).
