# vibetrace

`vibetrace` — Stay in control of your vibe coding sessions. It auto-commits your work in the background, lets you pin known-good checkpoints, and restores your project to any earlier state with full context for your AI assistant.

## Install

```bash
npm install -g vibetrace
# or
pnpm add -g vibetrace
# or directly from GitHub
npm install -g github:ccdejene/vibetrace
```

The command is `vibe`.

## Requirements

- Node.js 18+
- Git installed and on your `PATH`
- Git `user.name` and `user.email` configured

## Quick Start

```bash
cd your-project
vibe init                      # sets up hooks, .gitignore rules, and protections
vibe pin "Working login flow"  # save a checkpoint whenever things are working
```

If you're using Claude Code or Codex, commits happen automatically after each session. `vibe watch` is optional and adds file-change-based auto-commits on top.

## Commands

| Command | Description |
|---|---|
| `vibe init` | Initialize vibe in the current project |
| `vibe watch` | Start the auto-commit watcher |
| `vibe watch --daemon` | Start watcher in the background |
| `vibe watch --stop` | Stop the background watcher |
| `vibe pin [label]` | Save current state as a named checkpoint |
| `vibe log` | Show recent commits |
| `vibe log --all` | Show all commits |
| `vibe log --pinned` | Show pins only |
| `vibe restore <ref>` | Restore by pin label, hash, or `~N` |
| `vibe show <ref>` | Show details for a commit or pin |
| `vibe diff [ref1] [ref2]` | Show what changed between two points |
| `vibe doctor` | Validate your environment and project setup |
| `vibe install-hooks` | Install Claude hooks and Codex skill |
| `vibe uninstall-hooks` | Remove Claude hooks and Codex skill |

## How It Works

- `vibe init` sets up auto-committing, `.gitignore` rules, and AI tool integrations
- Credentials are scrubbed from commit messages before writing to disk or git
- `vibe restore` rolls back files, preserves history, writes `.vibe/restore-context.md`, and restarts your dev server automatically

## AI Tool Integration

### Claude Code (automatic)

`vibe init` installs hooks into Claude Code that fire automatically:
- When you submit a prompt → intent is saved
- When Claude finishes → `vibe commit` runs and tags the commit as `[vibe:claude]`

No manual steps needed.

### Codex (skill-based)

`vibe init` installs a Codex skill to `~/.codex/skills/vibetrace/`. The skill instructs Codex to:
- When Codex finishes → run `vibe commit --tool codex` and tag the commit as `[vibe:codex]`

Unlike Claude Code hooks, Codex skills are instructional — Codex follows them as guidance rather than firing automatically. You can also prompt Codex directly: *"commit with vibe when done"*.

## Restore

```bash
vibe restore ~1          # go back one commit
vibe restore abc1234     # go back to a specific hash
vibe restore "login"     # search by commit message
```

After restoring, your AI assistant automatically gets context about what state you're at and what was attempted before.

## Examples

**Starting a new project session**
```bash
vibe init
vibe watch --daemon
# start prompting Claude or Codex — changes are auto-committed as you go
```

**Pin a working state before trying something risky**
```bash
vibe pin "Auth working, before refactor"
# ask Claude to refactor...
# something broke
vibe log --pinned        # find your last good pin
vibe restore "Auth working, before refactor"
# back to where it worked, dev server restarted automatically
```

**See what happened in your session**
```bash
vibe log                 # last 10 commits
vibe log --all           # full history with +/- stats
vibe show abc1234        # full prompt and changes for a specific commit
```

**Undo the last change**
```bash
vibe restore ~1
```

## Notes

- `.vibe/` is local metadata — kept out of your repo via `.gitignore`
- `.claude/` is also gitignored — it's local config, not project state
- `vibe` sits on top of git, it does not replace it
