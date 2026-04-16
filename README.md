# skillset

![banner](./media/banner.png)

Manage skills and plugins for Claude. Group skills from [skills.sh](https://skills.sh) or GitHub into named collections and install them with a single command.

## Requirements

- [Claude CLI](https://claude.ai/download) must be installed

## Installation

```bash
npm install -g @andbc/skillset
```

## Usage

```bash
skillset <command>
```

## Commands

| Command | Description |
|---|---|
| `create` | Create a new skillset |
| `add <url\|plugin@marketplace>` | Add a skill or plugin reference |
| `remove [skillset] [skill]` | Remove a skill or plugin from a skillset |
| `list [owner/repo]` | List skillsets locally or from a GitHub repo |
| `install <path\|owner/repo>` | Install skillsets from a local path or GitHub |

## Workflow

**1. Create a skillsets repo**

```bash
mkdir my-skillsets && cd my-skillsets
skillset create
```

**2. Add skills and plugins**

```bash
# skills.sh or GitHub skill
skillset add https://skills.sh/user/repo/skill-name
skillset add https://github.com/user/repo

# Claude Code plugin (marketplace must be configured first)
skillset add plugin-name@marketplace-name
```

References are stored in `.skillsets/<name>.json` — no files are copied.

**3. Push to GitHub, then install anywhere**

```bash
skillset install user/my-skillsets
```

Or install from a local path:

```bash
skillset install .
```

Skills are always installed at **project scope** — into the current working directory's `.claude/` folder.

## Skillset format

Each skillset is a JSON file in the `.skillsets/` directory:

```json
{
  "$skillset": true,
  "name": "frontend",
  "description": "Frontend development skills",
  "dependencies": [
    {
      "skill": "skill-name",
      "repo": "user/repo",
      "source": "https://skills.sh/user/repo/skill-name"
    },
    {
      "type": "plugin",
      "name": "plugin-name",
      "marketplace": "marketplace-name"
    }
  ]
}
```
