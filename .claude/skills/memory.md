---
name: agent-memory-hygiene
description: Use whenever a CLAUDE.md, LEARNINGS.md, AGENTS.md, or any coding-agent memory/context file is growing large, feels bloated, is causing the agent to ignore instructions, or the user is asking how to structure, split, prune, or maintain these files. Also trigger when setting up a new project's memory system, when the user mentions "context window," "always-loaded," multi-agent/parallel sessions needing shared context, or when a memory file crosses roughly 300-500 lines and needs restructuring rather than continued appending.
---

# Agent Memory Hygiene

Keeping CLAUDE.md / LEARNINGS.md files useful as they grow, instead of letting them become an unmanageable, ignored wall of text.

## The core problem

CLAUDE.md and LEARNINGS.md files are loaded into **every session's context automatically**, before any work happens. Unlike a skill's bundled resources, they're not optional or on-demand — they're a tax paid on every single message. Left unmanaged, people append to them after every session ("learned that X breaks Y", "remember to always Z"), and the file grows monotonically because nothing ever gets removed.

Two failure modes result:
1. **Token/attention bloat** — a large chunk of every session's budget goes to instructions, most of which are irrelevant to the current task.
2. **Instruction dilution** — LLMs handle a bounded number of instructions reliably (rule of thumb: roughly 150-200 distinct, non-conflicting directives). Past that, the model doesn't fail loudly; it starts silently deprioritizing or ignoring instructions, including ones that matter. A 1500-line file isn't "safe because Claude has a big context window" — it's actively working against you.

**The line-count question is a proxy for the real question**: is this content always relevant, or only sometimes relevant? Always-relevant content (core stack, non-negotiable conventions, where things live) belongs in the always-loaded file and should be kept ruthlessly short. Sometimes-relevant content (a specific subsystem's quirks, a one-off debugging war story, framework-specific rules) belongs in a file that loads on demand.

## Diagnosis: is a file actually "too big"?

Don't just look at line count. Ask:

- **Is everything in it needed on every single task?** If no, it should be split — regardless of whether it's 200 lines or 1500.
- **Is it append-only with no pruning?** A file that only grows is going stale by construction — old learnings from a refactored subsystem are still sitting there as noise.
- **Is it a chronological log or a compressed rule set?** "Session 14: tried X, failed because Y, then did Z" is a diary. A memory file should read like a rulebook: "Use Z for [situation], not X (Y breaks it)." The diary form is 5-10x more verbose than the rule form for the same information.
- **Does it have structure at all, or is it one flat scroll?** A 1500-line file split into a skinny index plus well-organized reference docs is fine — Claude only pulls in what's relevant. A 1500-line flat file is not.

## The pattern: index + on-demand references

```
CLAUDE.md                    <- short, always loaded, ~50-150 lines
LEARNINGS.md                 <- same treatment as CLAUDE.md; keep it lean
docs/
  learnings/
    physics-engine.md        <- loaded only when Claude is touching that area
    drag-and-drop.md
    ai-action-queue.md
    build-tooling.md
```

The root file stays small and acts as a table of contents / rulebook for things true across the whole project. It references the deeper files by path and by a one-line description of when to consult them:

```markdown
## Subsystem notes
- Physics engine quirks → docs/learnings/physics-engine.md
- dnd-kit / worldStore gotchas → docs/learnings/drag-and-drop.md
- AI action queue (useActionQueue, ActionExecutor, DSL) → docs/learnings/ai-action-queue.md
```

Claude reads the reference file only when it's actually working in that area, so the "always loaded" cost stays flat even as total project knowledge grows. This is the same progressive-disclosure principle Claude Code skills use internally (metadata always loaded → SKILL.md body loaded on trigger → bundled resources loaded on demand) — it applies equally well to hand-maintained memory files.

**Note on `@` imports**: referencing a file with `@docs/foo.md` syntax in CLAUDE.md pulls its full content into context at startup — it does NOT achieve on-demand loading. It's useful for splitting a file for editing convenience or team ownership, but it doesn't reduce the always-loaded token cost. Only a written pointer ("see docs/learnings/x.md when working on x") that Claude decides to follow gets you real on-demand behavior.

## Format: compress into rules, not narrative

Bad (narrative log, append-only):

```markdown
### 2026-08-14
Spent an hour debugging why ingredients dropped into despensa were being 
mutated globally. Turned out entities were shared object references across 
lists instead of being cloned per-list. Fixed by giving each list its own 
instance on drop.
```

Good (compressed rule, same information):

```markdown
- Ingredient entities must be cloned per-list on drop — never share object 
  references across lists (caused global mutation bugs, see worldStore).
```

The good version is what you actually want Claude to internalize and act on. The narrative version is what a human would want to read in a git log or changelog — it belongs in commit messages or a CHANGELOG.md, not in the context Claude reloads every session.

A useful template per entry:

```markdown
- [WHAT to do / avoid] — [WHY, one clause, only if non-obvious]
```

If you can't compress a learning to one or two lines, it's either not a stable rule yet (park it in a scratch section) or it's subsystem-specific and belongs in a reference file, not the root.

## Maintenance workflow

**On an ongoing basis:**
- After a session that produced a real, durable insight, add ONE compressed line to the right file (root for universal, subsystem file for local).
- Don't let Claude auto-append verbose session summaries. If using a "learnings loop" (read at start, write at end), constrain the write step explicitly: "add at most 1-3 compressed bullet points, no narrative, no timestamps unless the learning is time-sensitive."

**Periodically (e.g. every ~10-15 sessions, or whenever a file crosses ~300-500 lines):**
1. Read the whole file in one pass.
2. Merge duplicates and near-duplicates.
3. Delete anything superseded by a later architectural decision (e.g. learnings about the two-list drag-and-drop system are dead weight after the N-list refactor).
4. Promote patterns that show up 3+ times into a firm rule stated once; delete the individual instances.
5. Split out anything that's grown into its own topic into a reference file.
6. If something hasn't been relevant in a long time and isn't foundational, cut it — git history still has it if it's ever needed again.

This consolidation pass is itself a good task to hand to Claude directly: "read LEARNINGS.md, propose a pruned/merged version, show me a diff before applying."

## Multi-agent / parallel session considerations

When splitting frontend and backend work across parallel Claude Code instances (or any multi-agent setup), the same index+reference pattern maps naturally onto agent boundaries:

- Keep a root CLAUDE.md with only what's true for the whole repo (stack, shared conventions, how packages relate).
- Give each subsystem/package its own CLAUDE.md or reference file with only what that agent needs. Claude Code already auto-loads CLAUDE.md files from parent directories and on-demand from child directories when you `cd` into them or touch files there — so a per-package file naturally scopes itself to the agent working in that package, without manual routing.
- Avoid one shared LEARNINGS.md that every parallel agent appends to — it becomes a merge-conflict and dilution magnet. Prefer per-subsystem learnings files, consolidated back to root periodically by a human or a dedicated pass.

## Quick checklist before adding to a memory file

- [ ] Is this true every time, or only in one subsystem/situation? → route accordingly
- [ ] Is this stated as a rule ("do X, not Y, because Z"), not a story?
- [ ] Is it one to two lines?
- [ ] Does something similar already exist in the file? (merge, don't duplicate)
- [ ] Will this still be true after the current refactor lands? If not, it's not durable — don't add it, or add it with an explicit expiry note.
