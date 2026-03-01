# vibetrace

`vibetrace` — Stay in control of your vibe coding sessions. It auto-commits your work in the background, lets you pin known-good checkpoints, and restores your project to any earlier state with full context for your AI assistant.

## Install

```bash
npm install -g vibetrace
# or
pnpm add -g vibetrace
```

The command is `vibe`.

## Requirements

- Node.js 18+
- Git installed and on your `PATH`
- Git `user.name` and `user.email` configured

## Quick Start

```bash
cd your-project
vibe init       # sets up hooks, .gitignore rules, and protections
vibe watch      # start auto-committing in the background
vibe pin "Working login flow"
```

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
| `vibe install-hooks` | Install Claude and Codex prompt hooks |
| `vibe uninstall-hooks` | Remove Claude and Codex prompt hooks |

## How It Works

- `vibe init` installs hooks into Claude Code and Codex so your prompts are saved as commit intent before each session
- When Claude or Codex finishes, `vibe` commits the changes tagged with the source (`[vibe:claude]`, `[vibe:codex]`)
- Credentials are scrubbed from commit messages before writing to disk or git
- `vibe restore` rolls back files, preserves history, writes `.vibe/restore-context.md`, and restarts your dev server automatically

## Restore

```bash
vibe restore ~1          # go back one commit
vibe restore abc1234     # go back to a specific hash
vibe restore "login"     # search by commit message
```

After restoring, your AI assistant automatically gets context about what state you're at and what was attempted before.

## Notes

- `.vibe/` is local metadata — kept out of your repo via `.gitignore`
- `.claude/` is also gitignored — it's local config, not project state
- `vibe` sits on top of git, it does not replace it
