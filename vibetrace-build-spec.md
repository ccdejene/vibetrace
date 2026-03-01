# Vibetrace - Build Spec

## What You're Building

A Node.js CLI tool called `vibe` that wraps git to make AI-assisted coding sessions recoverable. It silently auto-commits every file change with descriptive messages, lets the user "pin" working states, and can restore to any point in history while generating a context file that tells the AI what was attempted and what failed.

This is NOT a replacement for git. It's a thin layer on top of git that adds two things git can't do:

1. Silent auto-commits with AI-friendly descriptions after every file change
2. Context-aware restore that generates a briefing for the AI on what went wrong

---

## Tech Stack

- **Runtime:** Node.js (ES modules)
- **Package manager:** npm
- **Git interaction:** simple-git (npm package) or raw git commands via child_process
- **CLI framework:** Commander.js
- **YAML handling:** js-yaml
- **File watching:** chokidar (for auto-commit daemon)
- **Publish as:** global npm package (`npm install -g vibetrace`)

---

## Project Structure

```
vibe/
├── package.json
├── bin/
│   └── vibe.js                  # CLI entry point (#!/usr/bin/env node)
├── src/
│   ├── commands/
│   │   ├── init.js              # vibe init
│   │   ├── pin.js               # vibe pin
│   │   ├── log.js               # vibe log
│   │   ├── restore.js           # vibe restore
│   │   ├── show.js              # vibe show
│   │   ├── diff.js              # vibe diff
│   │   └── watch.js             # vibe watch (auto-commit daemon)
│   ├── lib/
│   │   ├── git.js               # Git operations wrapper
│   │   ├── pins.js              # Pin storage and lookup
│   │   ├── context-generator.js # Generates restore-context.md
│   │   ├── commit-message.js    # Generates descriptive commit messages from diffs
│   │   └── config.js            # Read/write .vibe/config.yaml
│   └── index.js                 # Main exports
├── .vibe/                       # Created by `vibe init` in user's project
│   ├── config.yaml
│   └── pins.yaml
└── README.md
```

---

## Commands to Implement

### 1. `vibe init`

Initialize vibe checkpoints in the current project directory.

**What it does:**
- Check if a git repo exists. If not, run `git init`
- Create `.vibe/` directory with default config
- Add `.vibe/` to `.gitignore` (we don't want meta files committed to the project's actual git)
- Wait — actually NO. The `.vibe/pins.yaml` and config should be in `.vibe/` but the actual commits happen in the project's git repo. So `.vibe/` stores only our metadata, not git data
- Create initial auto-commit of current state: `[vibe:auto] Initial state`
- Print success message with quick start instructions

**Default config.yaml:**
```yaml
auto_commit:
  enabled: true
  debounce_ms: 2000          # Wait 2s after last file change before committing
  
ignore:
  - node_modules/
  - .git/
  - .vibe/
  - .next/
  - dist/
  - build/
  - __pycache__/
  - "*.pyc"
  - .env
  - .env.local
  - .DS_Store
  - coverage/
  - .cache/
```

**Default pins.yaml:**
```yaml
pins: []
# Each pin entry:
# - label: "Auth working"
#   hash: "a3f8c2e..."
#   timestamp: "2026-02-28T14:30:00Z"
```

---

### 2. `vibe pin [label]`

Mark the current state as a known-good checkpoint.

**Usage:**
```bash
vibe pin "Dashboard layout complete"    # Pin with a label
vibe pin                                 # Pin with auto-generated label from recent changes
```

**What it does:**
1. Stage and commit any uncommitted changes first (as an auto-commit)
2. Get the current HEAD commit hash
3. If no label provided, generate one from the last few commit messages (e.g., take the most recent auto-commit message and clean it up)
4. Create a git tag: `vibe-pin-{timestamp}` pointing to HEAD
5. Add entry to `.vibe/pins.yaml`:
   ```yaml
   - label: "Dashboard layout complete"
     hash: "a3f8c2e1b4d..."
     timestamp: "2026-02-28T15:30:00Z"
     tag: "vibe-pin-20260228T153000"
     auto_commits_since_last_pin: 4
   ```
6. Print confirmation: `★ Pinned: "Dashboard layout complete" (a3f8c2e)`

---

### 3. `vibe log`

Show the session timeline.

**Usage:**
```bash
vibe log                                 # Show pins only (default, clean view)
vibe log --all                           # Show everything including auto-commits
vibe log --between "Auth" "Dashboard"    # Show auto-commits between two pins
vibe log --unpinned                      # Show auto-commits since last pin
vibe log -n 10                           # Limit to last 10 entries
```

**Default output (pins only):**
```
  a3f8c2e  ★  "Dashboard layout complete"     3:30 PM   (4 changes)
  f4b2d7e  ★  "Auth working"                  2:50 PM   (7 changes)
  a2c7b9e  ★  "Project init"                  2:10 PM   (3 changes)
```

**--all output:**
```
  b1c2d3e  →  Modified Button hover states                 3:42 PM
  e4f5a6b  →  Created Button component                    3:40 PM
  c7d8e9f  →  Added component folder structure             3:38 PM
  a3f8c2e  ★  "Dashboard layout complete"                 3:30 PM
  d1e2f3a  →  Fixed sidebar z-index on mobile              3:25 PM
  ...
```

**Implementation:**
- Read git log, filter by `[vibe:auto]` prefix for auto-commits and check pins.yaml for pins
- Default view: only show commits that have a corresponding pin entry
- Show count of auto-commits between each pin as "(N changes)"
- Color coding: ★ in yellow/gold for pins, → in dim gray for auto-commits
- Use chalk or similar for terminal colors

---

### 4. `vibe restore <reference>`

The killer feature. Restore to a previous state AND generate context for the AI.

**Usage:**
```bash
vibe restore "Auth working"              # By pin label (fuzzy match)
vibe restore a3f8                        # By commit hash (short or full)
vibe restore ~2                          # 2 pins back
vibe restore --search "sidebar"          # Search commit messages
```

**What it does:**

**Step 1: Safety net**
- Auto-commit current state: `[vibe:auto] Pre-restore safety net`
- Save the current HEAD hash so user can get back if needed

**Step 2: Resolve the target**
- Pin label → look up hash in pins.yaml (fuzzy match with string similarity)
- Short hash → expand via git
- ~N → count back N pins in pins.yaml
- --search → search all commit messages, show matches, let user pick

**Step 3: Collect context**
- Get all commits between the restore target and current HEAD (git log)
- For each commit, collect: hash, message, timestamp, files changed
- Identify which commits were pinned (verified working by user)
- Identify the failure pattern (where things started going wrong)

**Step 4: Reset files**
- Run `git reset --hard <target-hash>`
- Verify the reset worked

**Step 5: Generate restore-context.md**
- Write `.vibe/restore-context.md` in the project root
- This file is THE key deliverable — it's what the AI reads to understand what happened

**Step 6: Output**
```
RESTORED: "Auth working" (a3f8c2e)

   Rolled back 6 commits (2 pins, 4 auto-commits)
   
   Context file generated: .vibe/restore-context.md
   
   Paste this into your AI assistant or it will be auto-detected
   by supported Vibe integrations if enabled.
   
   To undo this restore: vibe restore b1c2d3e
```

**restore-context.md format:**

```markdown
# Vibe Restore Context

> Paste this into your AI coding assistant so it knows what happened.
> If you're using a supported AI tool integration with Vibe, this is
> loaded automatically.

## Current State

Project restored to: **"Auth working"**  
Restored at: 4:15 PM  
Commit: a3f8c2e  

## What Was Working at This Point

(Generated from the pinned commit's message and the files present)

Files in project at this state:
- src/lib/auth.ts
- src/middleware.ts
- src/app/login/page.tsx
- src/app/dashboard/page.tsx
- package.json
- (etc.)

## What Was Attempted After This Point

### ★ PIN: "Dashboard layout complete" — 3:30 PM (a3f8c2e → d4e5f6a)
The following changes were made and verified working by the user:

- `[vibe:auto]` Added component folder structure (3:38 PM)
  - Files: components/ directory created
- `[vibe:auto]` Created Button component (3:40 PM)
  - Files: components/Button.tsx (+), app/dashboard/page.tsx (~)
- `[vibe:auto]` Added hover state to button (3:41 PM)
  - Files: components/Button.tsx (~), styles/button.css (+)
- `[vibe:auto]` Fixed button color (3:42 PM)
  - Files: components/Button.tsx (~)

### After last pin (UNPINNED — user did NOT verify these worked):

- `[vibe:auto]` Added D3 chart to dashboard (3:58 PM)
  - Files: components/Chart.tsx (+), lib/d3-bindings.ts (+), app/dashboard/page.tsx (~)
- `[vibe:auto]` Fixed chart re-render loop (4:05 PM)
  - Files: components/Chart.tsx (~), hooks/useChartData.ts (+)
- `[vibe:auto]` Emergency chart fix (4:12 PM)
  - Files: components/Chart.tsx (~), hooks/useChartData.ts (~), hooks/useRealtimeData.ts (~), app/dashboard/page.tsx (~)

## Summary

The project was stable through the "Dashboard layout complete" pin.
Problems started with the D3 chart integration at 3:58 PM and escalated
through 3 attempts to fix re-render issues. The user chose to restore
to "Auth working" which is before the dashboard layout changes as well.

## Instructions for AI

The codebase is now at the "Auth working" state. All files have been
reset to this point. The changes listed above have been undone.
Do NOT re-attempt the same approaches that failed unless the user
specifically asks. Consider alternative strategies for any features
that were attempted but failed after this restore point.
```

---

### 5. `vibe show <reference>`

Show details about a specific commit or pin.

**Usage:**
```bash
vibe show "Auth working"                 # By pin label
vibe show a3f8c2e                        # By hash
```

**Output:**
```
★ PIN: "Auth working"
  Hash:      a3f8c2e1b4d...
  Time:      2:50 PM, Feb 28 2026
  
  Commit message:
    [vibe:auto] Set up JWT authentication with login/logout flow
    
    Files changed:
    - src/lib/auth.ts (created)
    - src/middleware.ts (created)
    - src/app/login/page.tsx (created)
    - src/app/api/auth/route.ts (created)
    
  Changes since previous pin: 7 auto-commits
```

---

### 6. `vibe diff [ref1] [ref2]`

Show what changed between two points.

**Usage:**
```bash
vibe diff                                # Changes since last pin
vibe diff "Auth working"                 # Changes between pin and now
vibe diff "Auth" "Dashboard"             # Changes between two pins
vibe diff a3f8c2e                        # What changed at this specific commit
```

**Implementation:** Thin wrapper around `git diff` with nicer formatting.

---

### 7. `vibe watch`

Start the auto-commit file watcher daemon.

**Usage:**
```bash
vibe watch                               # Start watching in foreground
vibe watch --daemon                      # Start in background
vibe watch --stop                        # Stop background watcher
```

**What it does:**
1. Use chokidar to watch for file changes in the project directory
2. Respect ignore patterns from `.vibe/config.yaml`
3. Debounce: wait `debounce_ms` (default 2000ms) after the last change before committing
4. When triggered:
   a. `git add -A` (stage all changes)
   b. Generate a commit message from the diff:
      - Look at which files were added/modified/deleted
      - Create a descriptive message like: "Modified components/Button.tsx and styles/button.css"
      - Better: summarize the type of change: "Updated Button component styling"
   c. Commit with `[vibe:auto]` prefix
5. Print a subtle notification: `→ Auto-saved: Modified Button styling (2 files)`

**Commit message generation (no AI needed):**
```
Rules:
- 1 file created: "Created {filename}"
- 1 file modified: "Modified {filename}"  
- 1 file deleted: "Deleted {filename}"
- Multiple files, same dir: "Updated {directory}/ ({n} files)"
- Multiple files, mixed dirs: "Modified {primary_file} and {n-1} other files"
- All in one dir: "Changes in {directory}/"

Prefix all with [vibe:auto]
```

---

## Data Flow

```
User codes with AI assistant
         │
         ▼
   Files change on disk
         │
         ▼
   vibe watch detects changes
         │
         ▼
   Debounce (2s default)
         │
         ▼
   git add -A && git commit -m "[vibe:auto] description"
         │
         ▼
   (repeat silently forever)
         │
         ▼
   User checks app → "looks good!"
         │
         ▼
   vibe pin "Feature done"
         │
         ▼
   Git tag created, entry in pins.yaml
         │
         ▼
   (continue coding...)
         │
         ▼
   Something breaks 💀
         │
         ▼
   vibe log → find the right pin
         │
         ▼
   vibe restore "Feature done"
         │
         ▼
   Files reset + restore-context.md generated
         │
         ▼
   AI reads context → knows what failed → takes different approach
```

---

## Important Implementation Details

### Fuzzy matching for pin labels
When user types `vibe restore "auth"`, fuzzy match against all pin labels in pins.yaml. Use case-insensitive substring matching first, fall back to string similarity. If multiple matches, show a selection prompt.

### Hash resolution
Short hashes should be expanded via `git rev-parse`. Support the same short-hash behavior as git (minimum 4 chars unique prefix).

### Relative pin references
`~1` means the most recent pin, `~2` means the one before that, etc. Only count pins, not auto-commits.

### The watch daemon should be resilient
- Don't crash on git errors (e.g., nothing to commit)
- Don't commit if only ignored files changed
- Handle rapid successive changes with debounce
- Skip commits during a restore operation (set a lock file)

### Restore should be safe
- Always create a safety-net commit before restoring
- Print the hash the user can use to undo the restore
- Don't restore if there are uncommitted changes (commit them first)
- Set a `.vibe/.restoring` lock file during restore so the watcher doesn't interfere

### The context file is the product
The quality of restore-context.md is what makes this tool valuable. Put extra effort into making it clear, well-structured, and useful. The AI that reads it should immediately understand: where we are, what was tried, and what to avoid.

---

## CLI UX

### Colors and symbols
- `★` (gold/yellow) for pins
- `→` (dim gray) for auto-commits  
- `✓` (green) for successful operations
- `⏪` (blue) for restore operations
- `✗` (red) for errors

### Keep output minimal
- Don't print walls of text
- Use single-line confirmations for routine operations
- Only verbose output when user explicitly asks (--verbose)

### Make it feel fast
- Auto-commits should be invisible (no output unless --verbose)
- `vibe pin` should complete in under 500ms
- `vibe log` should be instant
- `vibe restore` can take 1-2s and that's fine (it's doing important work)

---

## MVP Scope

Build these first, in this order:

1. **`vibe init`** — set up the project
2. **`vibe watch`** — auto-commit daemon (this is the foundation)
3. **`vibe pin`** — mark good states
4. **`vibe log`** — view history
5. **`vibe restore`** — the killer feature
6. **`vibe show`** — inspect commits
7. **`vibe diff`** — compare states

Skip for now (build later):
- MCP server integration
- Plugin system for supported AI coding tools
- Cloud sync
- Team sharing
- Branching timelines

---

## Testing the Tool

After building, test with this scenario:

1. Create a test project with a few files
2. Run `vibe init`
3. Run `vibe watch`
4. Make some changes to files (simulate AI editing)
5. Wait for auto-commits
6. Run `vibe pin "Initial feature"`
7. Make more changes
8. Run `vibe pin "Second feature"`
9. Make some bad changes (simulate breakage)
10. Run `vibe log` — should show 2 pins
11. Run `vibe log --all` — should show all auto-commits
12. Run `vibe restore "Initial feature"`
13. Verify files are back to the right state
14. Check that `.vibe/restore-context.md` exists and is well-formatted
15. Verify you can see what was attempted after the restore point

---

## Package.json Essentials

```json
{
  "name": "vibetrace",
  "version": "0.1.0",
  "description": "Session-aware state management for AI-assisted coding",
  "type": "module",
  "bin": {
    "vibe": "./bin/vibe.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": [
    "vibe-coding",
    "ai",
    "git",
    "checkpoints",
    "version-control",
    "claude",
    "codex",
    "cursor"
  ]
}
```

---

## One More Thing

Remember: the target user is someone who does NOT understand code deeply. They're vibe coding. The tool should feel simple, not technical. Error messages should be human-friendly. The log should be scannable. The restore should feel like pressing undo. Make it feel like safety, not complexity.
