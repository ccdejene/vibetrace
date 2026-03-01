---
name: vibetrace
description: Use this skill in any project that has a .vibe/ directory. Tracks vibe coding session history with git checkpoints, pins, and restore. Apply implicitly whenever working in a vibe-initialized project.
---

## vibetrace — Stay in control of your vibe coding sessions

This project uses `vibe` (vibetrace) for session history tracking.

### After completing any task

Always run `vibe commit` after finishing changes to record the session with full context.

```bash
vibe commit
```

### Review session history

```bash
vibe log              # recent commits
vibe log --all        # full history with +/- change stats
vibe show <hash>      # full prompt and file changes for a commit
```

### Recover a previous state

```bash
vibe restore ~1                  # undo last change
vibe restore <hash>              # go back to a specific commit
vibe restore "search term"       # find and restore by message
```

After restoring, context is automatically written to `.vibe/restore-context.md` and the dev server is restarted.
