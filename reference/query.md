# `src/query.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

A real query interface over the structured domain data — the answer to
"I want this system to answer robot questions in the domain scope."
CONCEPT.md §14's boundary applies here exactly: an LLM's job is turning a
free-text question into a structured lookup (which action, which
parameter) — it is NOT this module's job to generate an answer from
general knowledge, and it's not what this returns. Everything below
reads only from the already-validated, already-cited JSON in data/ — the
same data ENGINE_INVARIANTS.md #10 already requires be authoritative
over an LLM for validation rules, now made queryable for domain
QUESTIONS too, not just execution.

## `ParameterAnswer`

- `allowedValues`: Closed-set values, if this parameter uses allowedValues.
- `numericRange`: Continuous range, if this parameter uses numericRange.
- `stateDetermining`: Whether this parameter actually determines the resulting state (transformedStateFromParameter) or is informational only — a real, load-bearing distinction this whole codebase has been careful about; answering a domain question without surfacing this would overstate how much the system actually enforces.
- `relevantNotes`: Every metadata.*Note field on the action whose key or text mentions this parameter id — the actual sourced domain knowledge, not a summary of it.
- `recipeUsages`: Every recipe step found using this action, with the value it chose for this parameter (if any) — real precedent, not a hypothetical.

## `DomainFactAnswer` / `answerAboutDomainFact`

The `CriticalControlPointSchema.domainFacts` sibling of
`answerAboutParameter` above (`ingredient.ts`'s `DomainFactSchema`,
`ROADMAP.md`'s "Structured DomainFact/PhysicalProperty records" gap,
closed 2026-08-17) — the concrete answer to that gap's own stated
problem: "a robot's planner/verifier cannot safely consult an English
paragraph for a safety-critical number at runtime." This returns the
already-validated, already-typed `DomainFact` object directly — no prose
parsing involved, matching `ENGINE_INVARIANTS.md` #10 the same way
`answerAboutParameter` already does for action parameters.

## `EntityDomainFactAnswer` / `answerAboutEntityDomainFact`

The `EntitySchema.domainFacts` sibling of `answerAboutDomainFact` above —
`ingredient.ts`'s `EntitySchema.domainFacts`, extended to entities
2026-08-17 once a real second forcing case existed
(`kosher_salt.json`'s/`flaky_salt.json`'s real, cited grams-per-teaspoon
figures). Same shape, same reasoning, a different source map.
