# LEARNINGS.md

**Tier 0 — read this whole file every session, before touching anything.**
It's short on purpose. The theme files below (`LEARNINGS_ENGINE.md`,
`LEARNINGS_DOMAIN.md`, `LEARNINGS_TOOLING.md`, `LEARNINGS_PROCESS.md`) are
Tier 1 — load only the one(s) matching what you're about to touch, not all
four. This file exists so a session that never opens a single theme file
still has the rules that would have saved the most time.

Restructured 2026-08-18 (was one flat, ever-growing append log; the theme
split on 2026-08-15 organized it by subject but not by IMPORTANCE, and the
four files had grown to 5,000+ lines combined). Two real changes from the
old convention:

- **Not everything learned gets logged anymore.** A dated entry now needs
  to be a lesson that would genuinely save a future session real time —
  not a changelog line (`git log` already has that) and not a bug-fix
  retrospective whose only lasting value was the fix itself (already in
  the code and its tests). Ask "would I want to read this at 2am with no
  other context" before adding one.
- **Obsolete/superseded entries get removed, not just appended past.**
  When a periodic prune (see below) finds an entry whose lesson no longer
  applies (the tool it warned about was fixed, the claim it made was
  later corrected by a *dated, still-present* entry elsewhere), delete it
  — don't leave dead advice sitting next to live advice with no way to
  tell them apart. Git history is the record of what used to be here;
  these files are supposed to be current, not archival.

## Core lessons (Tier 0 — always relevant)

**Verification discipline** — the single largest source of real bugs and
wasted effort this repo has hit, across engine code, domain facts, and
external documents alike:

- **Verify a claim against the actual repo state before acting on it —
  every time, regardless of how authoritative the source sounds.** This
  has caught real problems in: a user-supplied bug report, a scientific
  review, three different externally-pasted documents with fabricated or
  uncheckable citations, a formally-written refactor ticket describing a
  problem that didn't exist, a paper-derived ticket's own suggested test
  case, and — twice — this session's own just-written sentences. A
  confident tone, a formal-looking ticket, or a bracketed citation number
  is not evidence; grep the actual file.
- **A citation with no bibliography behind it is worse than no citation**
  — it reads as sourced when it isn't. Don't let a document's own
  confident framing borrow credibility it hasn't earned.
- **Don't trust a search-engine summary — fetch and read the actual
  source.** A summary has fabricated a specific number with a
  specific-sounding (wrong) source at least once here.
- **A hard-to-reverse, safety-relevant number is a decision for the repo
  owner, not something to auto-apply just because a citation was found.**
  "Verify this claim" and "apply what you found" are different requests
  even when phrased as one.
- **When auditing a "this should never happen" claim, tell apart
  STRUCTURAL justification (a real physical/logical impossibility — keep
  it) from UNVERIFIED-ABSENCE-OF-COUNTEREXAMPLE ("I looked and didn't
  find one" — retract or flag it).** The repo's own flagship forbidden-
  transition example turned out to be factually wrong for exactly this
  reason, sitting unchecked in three files since the first commit.
- **Never fabricate a plausible-sounding claim — even about this repo's
  own code — to make a diff, commit, or citation look more complete.**
  Say "unverified" instead.

**Testing discipline:**

- **Test a generalized function against a SECOND, different real example
  — not just the one it was built for.** The motivating example often
  can't exercise the actual edge case; this has caught real accuracy bugs
  more than once.
- **After any engine/schema change: re-run the full regression** (`npm
  test` + `npm run validate` + every demo/capability-test script), not
  just the new thing. Unit tests and the real-data integration checks are
  complementary, not redundant — each catches a class of bug the other
  structurally cannot.
- **Run a script for real before trusting it works** — wrong function
  names, wrong field names, and silently-dropped-not-erroring bugs have
  all been caught this way, never by reading the code alone.
- **A wrong/typo'd id can fail SILENTLY, not loudly** — an unresolvable
  reference gets filtered out and dropped rather than erroring. A step
  can look correct in every log line while quietly not using the
  ingredient you meant it to. Grep for orphaned references periodically.
- **When a surprising result comes from a tool you just built, verify the
  trace by hand before assuming the tool is wrong** — intuition about
  "the answer feels unlikely" is weaker evidence than a traced path
  through the actual data.

**Design/architecture:**

- **A mechanism proven correct for ONE role of a multi-role action is not
  evidence it was applied to every role.** Check the less-visible role
  explicitly (e.g. a COMBINE action's secondary instance, not just its
  target) — that's exactly where an asymmetric gap hides.
- **When a new capability/verb is added, it doesn't retroactively
  re-audit old data that now qualifies for it.** That seam (new mechanism
  × old entity) is where real gaps sit unnoticed until something probes
  it directly.
- **Don't introduce a second, parallel source of truth for a derivable
  fact.** Read it off the place it's already declared/computed instead —
  this exact move (a CCP floor read from real CCP data, a terminal-state
  check derived from existing transition data, a byproduct fraction
  derived from its sibling's cited range) has been the right call
  repeatedly.
- **Fix the mechanism/engine layer once a gap's real shape is understood,
  not a one-off patch bolted onto individual data files** — closes the
  gap structurally for every future case, not just today's instances.
- **Before building a new verb/field, check whether an existing one
  already almost covers it** (a wider enum value, a capability
  generalization, a shape already built for an unrelated case). A new
  fact forcing an existing mechanism wider is the common case; a genuinely
  new mechanism is rarer.

**Working with ambiguity / other people's input:**

- **A low hit-rate triaging a big external document (rules list, Reddit
  thread, review) is the expected, correct outcome, not a sign the triage
  was insufficient.** The value is in not missing the few real findings,
  not in maximizing volume added — most content in a broad, generic
  external document is already covered or out of scope.
- **When something ambiguous comes up with real cost differences between
  options, ask — don't silently pick one or silently ignore it.** Surface
  a second, unexpected thing (a second document appearing mid-task, a
  fabricated cross-reference) explicitly too.
- **Separate "the reading is unclear" from "the scope is unclear"** — a
  garbled instruction can still have a confident interpretation on one
  axis while genuinely needing a question on another. Ask about the part
  that's actually ambiguous, not the part you've already resolved.

## Theme file index (Tier 1 — load only what's relevant)

| File | Covers | Skip if you're touching... |
|---|---|---|
| [`LEARNINGS_ENGINE.md`](LEARNINGS_ENGINE.md) | `src/*.ts` architecture, invariants, engine bugs found/fixed, schema-shape tradeoffs | pure food-science facts, CLI tools, or process/verification lessons |
| [`LEARNINGS_DOMAIN.md`](LEARNINGS_DOMAIN.md) | Culinary/food-science modeling — HACCP thresholds, heat/thermal physics, doneness tables, technique verbs, and their citations | engine internals, CLI tools, or process lessons |
| [`LEARNINGS_TOOLING.md`](LEARNINGS_TOOLING.md) | Authoring/CLI tooling built on the engine — `recipe-explain.ts`/`validate-recipe.ts`, `recipe-narrator.ts`, `recipe-scaffold.ts` | engine internals, food science, or process lessons |
| [`LEARNINGS_PROCESS.md`](LEARNINGS_PROCESS.md) | Specific incidents behind the verification-discipline rules above — dated, with the concrete numbers/findings each one produced | you just need the rule, not the story — the Core section above already has it |

A change that doesn't obviously belong to one theme is fine to log
wherever it reads best. Link across files with a plain relative
reference, same as they already cross-reference `ROADMAP.md`/
`REFERENCES.md`.

## Periodic maintenance (do this, don't just read about it)

When a theme file crosses ~800 lines, or roughly every 10 dated sessions,
whichever comes first — re-review it:

1. **Drop** any entry whose generalizable lesson is now stated in this
   file's Core section (leave the entry's *specific, non-repeated*
   technical residue if any survives; drop the rest).
2. **Drop** pure bug-fix retrospectives where the fix is stable, tested,
   and the story doesn't teach a pattern beyond "this one bug existed."
3. **Compress** design-tradeoff entries that are already duplicated
   near-verbatim in the relevant `src/*.ts` doc comment down to a
   one-line pointer at that comment, instead of re-narrating it here.
4. **Remove, don't append past,** any entry a later, still-present entry
   has factually corrected — leave one short note at the correction site
   if the history is itself worth knowing, not two competing claims.
5. **Verify before deleting anything that cites a number or threshold** —
   confirm it's actually superseded, not just old.
