# ENGINE_INVARIANTS.md

This document does not explain the system — `CONCEPT.md` and `CLAUDE_DEV_CTX.md` do that. This document is the list of things that must never break, regardless of which architecture track (linear step-sequence vs. event-sourced/goal-based — see the open question at the top of `CONCEPT.md`) the implementation ends up following.

**For coding agents:** check generated code against every rule below before treating a change as correct. A change that violates one of these is wrong even if it compiles and passes other tests. If a task genuinely requires violating one, stop and flag it rather than silently proceeding — these are meant to be load-bearing, not aspirational.

## Invariants

1. **Recipes never contain executable knowledge.** A recipe declares intent (steps, or goals/constraints — track TBD), not logic. Cooking behavior lives on ingredients, tools, and actions, not on the recipe.
2. **Actions never know recipes.** An action (`PEEL`, `CUT`, `HEAT`, ...) is defined independently of any recipe that happens to use it. Actions must not reference or special-case specific recipes.
3. **Ingredients never know tools.** An ingredient's definition doesn't reference which tool acts on it; the *action* mediates the relationship (an action requires a tool and targets an ingredient — the ingredient itself stays tool-agnostic).
4. **Tools never know recipes.** Symmetric to #2 — a tool is defined by what it can do, never by which recipe calls for it.
5. **Instances are disposable.** A specific runtime ingredient/tool instance can be created, mutated, and discarded freely. Only the canonical knowledge definitions (§ below) are durable.
6. **Knowledge is immutable.** Canonical definitions (ingredient types, action definitions, tool definitions) don't change during execution — only instances do.
7. **The timeline is append-only.** Once an event is recorded, it is never edited or deleted. Corrections happen by appending new events, not rewriting history.
8. **Every world state must be reconstructable from events.** No state may exist that isn't derivable by replaying the event log from the start. If it can't be rebuilt from events, it isn't real state.
9. **Everything must remain deterministic.** Given the same initial state and the same event/action sequence, the outcome is always identical. No hidden randomness or unmodeled side effects.
10. **LLMs are never authoritative.** An LLM may turn free text into a structured intent/action proposal; it never directly asserts world state, and it never decides validation rules. The deterministic engine has final say.

## Provenance

Captured verbatim (translated where needed) from `masideas.md`'s closing proposal for this file. Cross-references: invariant 10 formalizes `CONCEPT.md` §14/§16; invariants 7–9 formalize `CONCEPT.md` §10 (event sourcing); invariant 1 is the open tension flagged in `CONCEPT.md` §12 and at the top of that file.
