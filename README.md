# skillset

Manage skillsets for Claude Code — group skills from [skills.sh](https://skills.sh) or GitHub into named collections and install them with a single command.

## Usage

```bash
npx @andbc/skillset <command>
```

## Commands

| Command | Description |
|---|---|
| `create` | Create a new skillset |
| `add <url>` | Add a skill reference from skills.sh or GitHub |
| `remove [skillset] [skill]` | Remove a skill from a skillset |
| `list [owner/repo]` | List skillsets locally or from a GitHub repo |
| `install <path\|owner/repo>` | Install skillsets from a local path or GitHub |

## Workflow

**1. Create a skillsets repo**

```bash
mkdir my-skillsets && cd my-skillsets
npx @andbc/skillset create
```

**2. Add skills**

```bash
npx @andbc/skillset add https://skills.sh/user/repo/skill-name
npx @andbc/skillset add https://github.com/user/repo
```

Skills are stored as references in `skillsets/<name>.json` — no files are copied.

**3. Push to GitHub, then install anywhere**

```bash
npx @andbc/skillset install user/my-skillsets
```

Or install from a local path:

```bash
npx @andbc/skillset install .
```

## Skillset format

Each skillset is a JSON file in the `skillsets/` directory:

```json
{
  "name": "frontend",
  "description": "Frontend development skills",
  "skills": [
    {
      "skill": "skill-name",
      "repo": "user/repo",
      "source": "https://skills.sh/user/repo/skill-name"
    }
  ]
}
```
