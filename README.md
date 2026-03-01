# vibetrace

`vibetrace` is a lightweight CLI for vibe coding sessions. It auto-commits work in the background, lets you pin known-good checkpoints, and can restore a project to an earlier state while generating recovery context for your AI assistant.

A static landing page source is included in `index.html` for simple project marketing or GitHub Pages deployment.

## Install

Install the package globally with `npm` or `pnpm`:

```bash
npm install -g vibetrace
pnpm add -g vibetrace
```

After install, the command you use is still:

```bash
vibe
```

## Requirements

- Node.js 18 or newer
- Git installed and available on your `PATH`
- A git repository for the project you want to protect
- Git `user.name` and `user.email` configured

You can verify your setup with:

```bash
vibe doctor
```

## Quick Start

Inside the project you want to protect:

```bash
vibe init
vibe watch
vibe pin "Initial feature"
```

That flow does four things:

1. Creates the local `.vibe/` metadata directory.
2. Adds `.vibe/` and `.claude/` to `.gitignore` when needed.
3. Installs Claude and Codex prompt hooks so prompts can become commit intent.
4. Starts a watcher that creates descriptive checkpoint commits as you work.

## Core Commands

- `vibe init` Initialize vibe in the current project
- `vibe watch` Start the auto-commit watcher
- `vibe watch --daemon` Start the watcher in the background
- `vibe watch --stop` Stop the background watcher
- `vibe pin [label]` Save the current state as a named checkpoint
- `vibe log` Show the checkpoint timeline
- `vibe log --all` Show pins and auto-commits
- `vibe restore <reference>` Restore by pin label, hash, or `~N`
- `vibe show <reference>` Show details for a checkpoint or commit
- `vibe diff [ref1] [ref2]` Show what changed between two points
- `vibe doctor` Validate your environment and current project setup
- `vibe intent "Message"` Set the next auto-commit message intent
- `vibe run --tool <claude|codex> "Prompt"` Run an AI tool and capture the prompt as intent
- `vibe install-hooks` Install Claude and Codex prompt hooks
- `vibe uninstall-hooks` Remove Claude and Codex prompt hooks

## End-User Setup

For a new machine or a new project:

1. Install the CLI globally with `npm install -g vibetrace` or `pnpm add -g vibetrace`.
2. Open the git repo you want to protect.
3. Run `vibe init`.
4. Run `source ~/.zshrc` or `source ~/.bashrc` if `vibe init` reports that the Codex hook was added.
5. Start automatic checkpointing with `vibe watch --daemon`.
6. Confirm everything is healthy with `vibe doctor`.

Once set up, you can work normally. Use `vibe pin "Working auth flow"` whenever you reach a stable point.

## Intent Hooks

If your AI tool writes prompt intent before edits, `vibe` can use that text as the next auto-commit message.

Supported files:

- `.vibe/intent.txt` as a single plain-text line
- `.vibe/intent.json` as JSON with a `message` field

Manual example:

```bash
vibe intent "Change UI because the layout feels crowded"
```

The next auto-commit uses that message, then clears the saved intent.

## AI Wrapper

You can run your AI tool through `vibe` so the prompt is captured automatically:

```bash
vibe run --tool claude "Refactor the UI layout"
vibe run --tool codex "Fix the failing tests"
```

## Restore Workflow

When you restore, `vibe` preserves history and writes `.vibe/restore-context.md` so your AI assistant can understand:

- what state you restored to
- what commits were skipped
- what changed after the checkpoint

This makes recovery practical instead of forcing you to reconstruct context from raw git history.

## Operational Notes

- `.vibe/` is local metadata and is intentionally kept out of your repo.
- `vibe` uses your existing git history. It does not replace git.
- The watcher should be stopped with `vibe watch --stop` before uninstalling the tool globally.
