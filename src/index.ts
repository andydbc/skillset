import { create } from './commands/create.js'
import { add } from './commands/add.js'
import { install } from './commands/install.js'
import { list } from './commands/list.js'
import { remove } from './commands/remove.js'
import kleur from 'kleur'

type Command = (args: string[], opts: { yes: boolean }) => Promise<void>
const commands: Record<string, Command> = { create, add, remove, install, list }

const argv = process.argv.slice(2)
const yes = argv.includes('--yes') || argv.includes('-y') || !process.stdin.isTTY
const rest = argv.filter(a => a !== '--yes' && a !== '-y')
const [command, ...args] = rest

if (!command || command === '--help' || command === '-h') {
  console.log(`
${kleur.bold('skillset')} — manage skillsets for Claude Code

${kleur.bold('Commands:')}
  ${kleur.cyan('create')}                    create a new skillset
  ${kleur.cyan('add')} ${kleur.dim('<url>')}                 add a skill reference to a skillset
  ${kleur.cyan('remove')} ${kleur.dim('[skillset] [skill]')} remove a skill from a skillset
  ${kleur.cyan('list')} ${kleur.dim('[owner/repo]')}         list skillsets (local or from GitHub)
  ${kleur.cyan('install')} ${kleur.dim('<path|owner/repo>')} install from a local path or GitHub

${kleur.bold('Flags:')}
  ${kleur.cyan('-y, --yes')}                    skip confirmation prompts

${kleur.bold('Examples:')}
  ${kleur.dim('npx @andbc/skillset create')}
  ${kleur.dim('npx @andbc/skillset add plugin@marketplace')}
  ${kleur.dim('npx @andbc/skillset add https://skills.sh/user/repo/skill-name')}
  ${kleur.dim('npx @andbc/skillset add https://github.com/user/repo')}
  ${kleur.dim('npx @andbc/skillset list user/my-skillsets')}
  ${kleur.dim('npx @andbc/skillset install .')}
  ${kleur.dim('npx @andbc/skillset install user/my-skillsets')}
  ${kleur.dim('npx @andbc/skillset install user/my-skillsets --yes')}
`)
  process.exit(0)
}

if (!commands[command]) {
  console.error(kleur.red(`Unknown command: ${command}`))
  process.exit(1)
}

commands[command](args, { yes }).catch(err => {
  console.error(kleur.red((err as Error).message))
  process.exit(1)
})
