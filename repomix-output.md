This file is a merged representation of a subset of the codebase, containing specifically included files, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of a subset of the repository's contents that is considered the most important context.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Only files matching these patterns are included: .
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
````
.claude/
  helpers/
    graft-hooks.cjs
    graft-statusline.cjs
  skills/
    graft/
      SKILL.md
  settings.json
  settings.local.json
data/
  actions/
    bake.json
    beat.json
    boil.json
    chili.json
    combine.json
    crack.json
    crush.json
    cut.json
    emulsify.json
    flip.json
    fold.json
    fry.json
    infuse.json
    mix.json
    pasteurize.json
    peel.json
    pepper.json
    poach.json
    salt.json
    scramble.json
    separate.json
    shock.json
    simmer.json
    wash.json
  ccps/
    egg_cooking.json
    egg_pasteurization_liquid.json
    egg_pasteurization_raw.json
  entities/
    black_pepper.json
    bowl.json
    chili_flakes.json
    egg_cracked.json
    egg_shell.json
    egg_white.json
    egg_yolk.json
    egg.json
    garlic_peel.json
    garlic.json
    knife.json
    mixer.json
    mortar.json
    oil.json
    oven.json
    pan.json
    pot.json
    potato_peel.json
    potato.json
    salt.json
    tortilla_mixture.json
    water.json
  heat-sources/
    gas.json
    vitro.json
    wood_fire.json
  recipes/
    french-omelette.json
    garlic-oil-potatoes.json
    handmade-alioli-egg-yolk.json
    handmade-alioli.json
    huevo-frito.json
    ruhei.json
    salted-fried-potatoes.json
    soft-boiled-egg.json
    tortilla-de-betanzos.json
    tortilla-de-patatas.json
    tortilla-francesa.json
graft/
  scripts/
    ask.md
    attempt-tortilla.md
    cook-egg-many-ways.md
    cook-potato-three-ways.md
    cut-potato.md
    egg-haccp.md
    egg-pasteurization.md
    mix-potato-peel.md
    reuse-potato-peel.md
    run-recipe.md
    salted-boiled-potato.md
    season-potato-three-ways.md
    separate-egg.md
    validate.md
    wash-and-peel-potato.md
  src/
    action.md
    engine.md
    ingredient.md
    query.md
    recipe-runner.md
    recipe.md
    registry.md
    thermal.md
  tests/
    action.test.md
    engine.test.md
    helpers.md
    ingredient.test.md
    recipe.test.md
    thermal.test.md
  INDEX.md
scripts/
  ask.ts
  attempt-tortilla.ts
  boil-egg-heat-sources.ts
  cook-egg-many-ways.ts
  cook-potato-three-ways.ts
  cut-potato.ts
  egg-haccp.ts
  egg-pasteurization.ts
  mix-potato-peel.ts
  reuse-potato-peel.ts
  run-recipe.ts
  salted-boiled-potato.ts
  season-potato-three-ways.ts
  separate-egg.ts
  simmer-vs-boil.ts
  validate.ts
  wash-and-peel-potato.ts
src/
  action.ts
  egg-doneness.ts
  engine.ts
  heat-source.ts
  ingredient.ts
  query.ts
  recipe-runner.ts
  recipe.ts
  registry.ts
  thermal.ts
tests/
  action.test.ts
  egg-doneness.test.ts
  engine.test.ts
  heat-source.test.ts
  helpers.ts
  ingredient.test.ts
  recipe.test.ts
  thermal.test.ts
.gitignore
.ignore
.mcp.json
CLAUDE_DEV_CTX.md
CLAUDE.md
CONCEPT.md
Culinary_Informatics_Research_Plan.pdf
ENGINE_INVARIANTS.md
LEARNINGS.md
masideas.md
package.json
ROADMAP.md
tsconfig.json
WORLD_MODEL.md
````

# Files

## File: .claude/skills/graft/SKILL.md
````markdown
---
name: graft
description: This repo is indexed by graft/. For ANY task here, whether
  understanding how something works, finding where code lives, tracing what
  calls a symbol or what a change breaks, or scoping an edit, get your context
  from graft before grepping or reading source files.
---

# graft

`graft/` holds a graph of this repo: small markdown nodes that each explain one
part in prose and name the exact `file:line` spans they cover, plus a wiring
graph of who-calls-what. Querying a node costs a few hundred tokens; rebuilding
that understanding by reading source costs thousands, and misses the edges.

Every command below is `$0`, needs no API key, and returns in under a second.
There are six of them. **Pick the one that fits the task, run it, act on the
answer; don't chain tools hoping for more. Most tasks need one call.**

## The tools

### 1 · `graft ask "<question>" --source`: locate + understand (the default)
Ranked retrieval over the graph, routed automatically between prose nodes and
the wiring graph, returning the top hits with exact `file:line`.
- `--source` inlines the code at each hit, the ≤8-line **crux** of each
  definition, so the result IS the code you need, no follow-up file read. Add
  `--full` only when the crux is too small to act on.
- `--in <path>` narrows to a subtree before ranking; `-n N` caps results (default 8).
- **Use it when** the question is conceptual or locational: "how does auth
  work", "where is rate-limiting handled", "what assembles the request pipeline".
- One ask usually answers. A genuinely multi-part question needs one ask per
  distinct sub-aspect, never the same question reworded. Few or weak hits mean
  switch tool (grep / skeleton / callers), don't re-ask.

### 2 · `graft grep "<pattern>"`: exhaustive find
Regex (or `--fixed` for a literal) over every indexed file, hits **grouped by
enclosing symbol** and ranked by coupling; it also reports files it couldn't read.
- **Use it when** you need every occurrence: all call sites, all uses of a
  constant, all providers. `ask` is ranked top-N and *will* miss instances;
  grep won't. One grep replaces a spray of asks.
- Search a **short symbol name or literal**, not a full guessed signature: an
  over-specific regex (`func (s *Server) GenerateHandler`) returns nothing even
  when the code is indexed. If a grep misses, **loosen it** (drop the receiver
  and signature, keep the bare name) and retry `graft grep` — do NOT switch to
  raw `grep -rn`, which is slower and unranked.
- `-i` case-insensitive; `--in <path>` scopes to a subtree. Raw `grep -rn` is
  only for files graft genuinely doesn't index (docs, configs, brand-new files).

### 3 · `graft skeleton <file>`: a file's API at a glance
Signatures-only view of one file (every function / method / type with its span)
in ~200 tokens, ~10x cheaper than reading the file.
- **Use it when** you need "what's in this file / what can I call here" before
  editing or wiring into it. One skeleton is the whole answer for a file; don't
  re-skeleton the same file, and don't skeleton every file `map` already named.

### 4 · `graft callers <symbol>`: the exact edges
Precomputed call/reference edges, not a text search. Symbol can be bare
(`Foo`), qualified (`Class.method`), or package-qualified (`pkg.Fn`).
- default `--direction in`: **who calls/references** this; run before you
  rename, delete, or change its signature.
- `--direction out`: **what this symbol itself calls/depends on** (the old `callees`).
- `--depth N`: walk transitively N hops for the **full blast radius** (the old
  `impact`); `--depth 2` is the usual "what breaks if I touch this".
- `--depth all`: the **entire connected closure** — every source reachable
  through the edges. Reach for this before a **refactor, rename, or any
  multi-file change**: it surfaces the sibling and downstream files (platform
  variants, a module you must split out) that a single-file edit would miss.

### 5 · `graft map`: orientation for an unfamiliar repo or area
A token-budgeted tour: directory clusters, per-directory hubs, and global
hotspots, straight from the wiring graph.
- **Use it when** you land in a repo cold or are asked for "the architecture".
  `map` alone is the answer: read the hub cards it names; do NOT then skeleton
  or ask your way through every subsystem it lists. `--max-dirs N` widens it.

### 6 · Lifecycle: `graft build` / `graft check`
Every tool above refreshes the graph itself before answering, so what those tools
return always describes the code as it is right now — including edits you just made
and have not committed. You do **not** need to run `build` after editing.

One caveat, if you `grep` the markdown under `graft/` directly: those cards are a
projection, rebuilt at the end of the turn rather than on each query, so after an edit
they can lag. The tools above never do — prefer them, and treat a card's spans as
stale if you have edited that file this turn.

`build` is for the LLM layer (`--deep` adds a concept map; skip unless asked);
`check` fails when `graft/` is stale, for CI.

## Scenarios: the shortest path through a coding task

| When you're… | Reach for | Calls |
|---|---|---|
| Onboarding / "explain this codebase" | `graft map`, then read the named hub cards | 1 |
| Understanding a flow ("how does X work") | `graft ask "<flow>" --source` | 1 |
| Finding where a change belongs | `graft ask "where is <behavior>" --source` | 1 |
| Editing a symbol you can already name | `graft grep "<symbol>"`, edit at the `file:line` (skip `ask` — you know where it is) | 1 |
| Renaming / deleting / changing a signature | `graft callers <sym> --depth 2` first | 1 |
| Refactor / multi-file change (before editing) | `graft callers <sym> --depth all` — map every connected file, don't stop at the first | 1 |
| "What does this depend on?" | `graft callers <sym> --direction out` | 1 |
| Finding every occurrence of a pattern | `graft grep "<literal>"` | 1 |
| "What's the API of this file?" | `graft skeleton <file>` | 1 |
| Debugging a failure in area X | `graft ask "<symptom>" --source`, then `callers` on the suspect | 1–2 |
| Judging a diff's risk before merge | `graft callers <changed sym> --depth 2` | 1 / symbol |
| Working inside one repo of a monorepo | add `--in <scope>/` to ask / grep / callers | n/a |

In a multi-repo workspace, graft ranks fairly so the biggest repo can't drown
the rest, and every hit carries a `[scope/]` label naming its sub-project; when
you already know where you're working, narrow with `graft ask "<task>" --in <scope>/`.

## Spend the fewest calls
- A node's `covers:` list already gives exact `file:line` for every symbol, so
  cite straight from it. The spans are generated from source and authoritative;
  don't re-open or re-grep files to "double-check".
- When the task already names the file or symbol to change, go straight there:
  `graft grep "<symbol>"` for the exact `file:line`, then edit. Reserve
  `graft ask` for when you don't yet know where the code lives — an `ask`
  round-trip is wasted on a target you can already name.
- Trust the answer and act. Reach for a second tool only when the first genuinely
  fell short: weak hits, a truncated span, or a need to be exhaustive.
- If graft names a path that isn't on disk, its index is ahead of your checkout
  (a branch switch or unpulled move). Don't read the missing file — `graft grep`
  the symbol to find where it lives now, or run `graft build` to refresh.

## Report what graft saved, every turn
Each retrieval tool **opens** its output with a `[graft] tokens saved ≈ N` line:
the estimated tokens that call saved versus reading the files it covers whole.
Whenever you used any graft tool in a turn, close your reply with a one-line
tally summing those numbers across every graft call you made, e.g.
`🌱 graft saved ~12,400 tokens this turn (3 calls)`. A call with no such line
(tiny files, where the pointers cost as much as the source) saved nothing, so
skip it. This is the per-turn figure; the statusline carries the running
session total.

**Never pipe a graft command through `head`, `tail`, or `sed -n`.** Every tool
is already capped and states what it dropped; clipping it costs you hits you
asked for, and it silently drops the savings line the statusline's running
total is parsed from.

## When graft isn't enough
- Span truncated ("+N more lines"): open the file at that exact range.
- A node lacks a detail: ask a more specific question; only then read source at
  the exact `file:line`, never a whole file to rebuild understanding graft gives.
- You may also grep / ls / cat inside `graft/` directly (plain markdown;
  `graft/INDEX.md` indexes the nodes), but the tools above are faster and
  exhaustive where it matters, so reach for them first.

When the graft MCP server is connected, these are exposed as tools too:
`graft_find_code`, `graft_find_all`, `graft_file_api`, `graft_trace_calls` (with
`direction` / `depth`), `graft_repo_map`, `graft_check_freshness`. Use whichever surface is
available; the guidance is identical.
````

## File: .claude/settings.local.json
````json
{
  "permissions": {
    "allow": [
      "Read(//home/felix/.codex/**)",
      "Read(//home/felix/.gemini/**)",
      "Bash(git config *)",
      "Bash(git init *)",
      "Bash(git branch *)",
      "Bash(git add *)",
      "Bash(git commit *)",
      "Bash(code /home/felix/claude/pro)",
      "Bash(npm -v)",
      "Bash(npm install *)",
      "Bash(npm run *)",
      "Bash(git -C /home/felix/claude/pro log --oneline -5)",
      "mcp__graft__graft_file_api",
      "mcp__graft__graft_find_code",
      "Bash(npx tsx *)",
      "Bash(npm test *)",
      "mcp__graft__graft_trace_calls",
      "Bash(npx tsc *)",
      "Bash(echo \"exit: $?\")",
      "Bash(cd *)",
      "Bash(node *)",
      "Bash(cp src/engine.ts /tmp/engine.ts.bak)",
      "Bash(python3 -)",
      "Bash(echo \"tsc exit \\(filtered\\): $?\")",
      "Bash(git checkout *)",
      "Bash(python3 -c ' *)",
      "Bash(cp data/entities/black_pepper.json /tmp/bp.bak)",
      "Bash(cp data/entities/potato.json /tmp/potato.bak)",
      "Bash(cp /tmp/potato_broken.json data/entities/potato.json)",
      "Bash(echo \"TSC exit: $?\")",
      "Bash(sed 's/\\\\.json$//')",
      "Bash(python3 -c \"import json,sys; d=json.load\\(sys.stdin\\); print\\(json.dumps\\({k:v for k,v in d.items\\(\\) if k in \\('capabilities','criticalControlPointsByAction','possibleTags'\\)}, indent=2\\)\\)\")",
      "Bash(python3 *)"
    ]
  },
  "enabledMcpjsonServers": [
    "graft"
  ]
}
````

## File: graft/scripts/ask.md
````markdown
# scripts/ask.ts

_No extracted symbols in this file._
````

## File: graft/scripts/attempt-tortilla.md
````markdown
# scripts/attempt-tortilla.ts

- apply · function · L30-L36 — function apply(instance: Instance, actionId: string, params?: Record<string, string>)
````

## File: graft/scripts/cook-egg-many-ways.md
````markdown
# scripts/cook-egg-many-ways.ts

- apply · function · L21-L33 — function apply(instance: Instance, actionId: string): Instance
- crack · function · L35-L42 — function crack(instance: Instance): Instance
- freshEgg · function · L44-L46 — function freshEgg(): Instance
- salt · function · L48-L53 — function salt(instance: Instance): Instance
- beat · function · L55-L60 — function beat(instance: Instance, intensity: "lightly_beaten" | "beaten" | "well_beaten"): Instance
````

## File: graft/scripts/cook-potato-three-ways.md
````markdown
# scripts/cook-potato-three-ways.ts

- apply · function · L9-L20 — function apply( instance: Instance, actionId: string, availableTools: ReadonlySet<string>, availableIngredients?: ReadonlySet<string> ): Instance
- washedAndPeeledPotato · function · L22-L27 — function washedAndPeeledPotato(): Instance
````

## File: graft/scripts/cut-potato.md
````markdown
# scripts/cut-potato.ts

- Step · interface · L10-L13 — interface Step
- run · function · L15-L28 — function run(steps: Step[]): Instance
````

## File: graft/scripts/egg-haccp.md
````markdown
# scripts/egg-haccp.ts

- fry · function · L30-L49 — function fry(instance: Instance, durationSeconds: number, policy?: SafetyPolicy)
````

## File: graft/scripts/egg-pasteurization.md
````markdown
# scripts/egg-pasteurization.ts

- pasteurize · function · L22-L37 — function pasteurize(waterTempC: number, durationSeconds: number, policy?: { mode: "human" | "autonomous" })
````

## File: graft/scripts/mix-potato-peel.md
````markdown
# scripts/mix-potato-peel.ts

- apply · function · L10-L22 — function apply( instance: Instance, actionId: string, params?: Record<string, string> ): ExecutionResult
````

## File: graft/scripts/reuse-potato-peel.md
````markdown
# scripts/reuse-potato-peel.ts

- apply · function · L10-L26 — function apply( instance: Instance, actionId: string, params?: Record<string, string>, availableIngredients?: ReadonlySet<string> ): ExecutionResult
````

## File: graft/scripts/run-recipe.md
````markdown
# scripts/run-recipe.ts

_No extracted symbols in this file._
````

## File: graft/scripts/salted-boiled-potato.md
````markdown
# scripts/salted-boiled-potato.ts

- apply · function · L9-L23 — function apply( instance: Instance, actionId: string, availableTools: ReadonlySet<string>, availableIngredients?: ReadonlySet<string> ): Instance
````

## File: graft/scripts/season-potato-three-ways.md
````markdown
# scripts/season-potato-three-ways.ts

- apply · function · L17-L23 — function apply(instance: Instance, actionId: string, availableIngredients: ReadonlySet<string>): Instance
- friedPotato · function · L25-L32 — function friedPotato(): Instance
````

## File: graft/scripts/separate-egg.md
````markdown
# scripts/separate-egg.ts

- apply · function · L10-L27 — function apply( instance: Instance, actionId: string, params?: Record<string, string>, availableIngredients?: ReadonlySet<string> ): ExecutionResult
````

## File: graft/scripts/validate.md
````markdown
# scripts/validate.ts

- loadDir · function · L10-L33 — function loadDir<T extends { id: string }>( dir: string, label: string, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } } )
- fail · function · L41-L44 — function fail(msg: string)
````

## File: graft/scripts/wash-and-peel-potato.md
````markdown
# scripts/wash-and-peel-potato.ts

_No extracted symbols in this file._
````

## File: graft/src/action.md
````markdown
# src/action.ts

- ActionParameter · type · L51-L51 — type ActionParameter = z.infer<typeof ActionParameterSchema>;
- ActionOutputs · type · L114-L114 — type ActionOutputs = z.infer<typeof ActionOutputsSchema>;
- VerificationCriterion · type · L148-L148 — type VerificationCriterion = z.infer<typeof VerificationCriterionSchema>;
- Hazard · type · L172-L172 — type Hazard = z.infer<typeof HazardSchema>;
- Action · type · L259-L259 — type Action = z.infer<typeof ActionSchema>;
````

## File: graft/src/engine.md
````markdown
# src/engine.ts

- Instance · interface · L95-L99 — interface Instance
- SafetyPolicy · interface · L115-L118 — interface SafetyPolicy
- ExecutionResult · interface · L122-L140 — interface ExecutionResult
- applyAction · function · L142-L375 — function applyAction( instance: Instance, action: Action, entities: Map<string, Entity>, availableTools: ReadonlySet<string>, params: Readonly<Record<string, string>> = {}, availableIngredients: ReadonlySet<string> = new Set(), ccps: ReadonlyMap<string, CriticalControlPoint> = new Map(), policy: SafetyPolicy = DEFAULT_SAFETY_POLICY, secondaryInstance?: Instance ): ExecutionResult
````

## File: graft/src/ingredient.md
````markdown
# src/ingredient.ts

- EntityKind · type · L17-L17 — type EntityKind = z.infer<typeof EntityKindSchema>;
- AggregationState · type · L29-L29 — type AggregationState = z.infer<typeof AggregationStateSchema>;
- Structure · type · L42-L42 — type Structure = z.infer<typeof StructureSchema>;
- Citation · type · L68-L68 — type Citation = z.infer<typeof CitationSchema>;
- Composition · type · L79-L79 — type Composition = z.infer<typeof CompositionSchema>;
- ThermophysicalProperties · type · L95-L95 — type ThermophysicalProperties = z.infer<typeof ThermophysicalPropertiesSchema>;
- SensoryProperties · type · L119-L119 — type SensoryProperties = z.infer<typeof SensoryPropertiesSchema>;
- Capabilities · type · L148-L148 — type Capabilities = z.infer<typeof CapabilitiesSchema>;
- CooklangInterop · type · L163-L163 — type CooklangInterop = z.infer<typeof CooklangInteropSchema>;
- Quantity · type · L245-L245 — type Quantity = z.infer<typeof QuantitySchema>;
- Entity · type · L318-L318 — type Entity = z.infer<typeof EntitySchema>;
````

## File: graft/src/query.md
````markdown
# src/query.ts

- ParameterAnswer · interface · L17-L39 — interface ParameterAnswer
- answerAboutParameter · function · L41-L85 — function answerAboutParameter( actions: Map<string, Action>, recipes: Map<string, RecipeScript>, actionId: string, parameterId: string ): ParameterAnswer | undefined
````

## File: graft/src/recipe-runner.md
````markdown
# src/recipe-runner.ts

- RecipeStepError · interface · L24-L27 — interface RecipeStepError
- RecipeRunResult · interface · L29-L36 — interface RecipeRunResult
- runRecipe · function · L38-L128 — function runRecipe( recipe: RecipeScript, entities: Map<string, Entity>, actions: Map<string, Action>, ccps: Map<string, CriticalControlPoint> = new Map(), policy?: SafetyPolicy ): RecipeRunResult
````

## File: graft/src/recipe.md
````markdown
# src/recipe.ts

- RecipeInstance · type · L31-L31 — type RecipeInstance = z.infer<typeof RecipeInstanceSchema>;
- RecipeStep · type · L51-L51 — type RecipeStep = z.infer<typeof RecipeStepSchema>;
- RecipeScript · type · L64-L64 — type RecipeScript = z.infer<typeof RecipeScriptSchema>;
````

## File: graft/src/registry.md
````markdown
# src/registry.ts

- loadDir · function · L9-L24 — function loadDir<T extends { id: string }>( dir: string, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } } ): Map<string, T>
- loadEntities · function · L26-L28 — function loadEntities(entitiesDir: string): Map<string, Entity>
- loadActions · function · L30-L32 — function loadActions(actionsDir: string): Map<string, Action>
- loadRecipes · function · L34-L36 — function loadRecipes(recipesDir: string): Map<string, RecipeScript>
- loadCcps · function · L38-L40 — function loadCcps(ccpsDir: string): Map<string, CriticalControlPoint>
````

## File: graft/src/thermal.md
````markdown
# src/thermal.ts

- ThermalInactivationModel · type · L39-L39 — type ThermalInactivationModel = z.infer<typeof ThermalInactivationModelSchema>;
- requiredHoldSeconds · function · L41-L43 — function requiredHoldSeconds(model: ThermalInactivationModel, actualTempC: number): number
- CriticalControlPoint · type · L99-L99 — type CriticalControlPoint = z.infer<typeof CriticalControlPointSchema>;
````

## File: graft/tests/action.test.md
````markdown
# tests/action.test.ts

_No extracted symbols in this file._
````

## File: graft/tests/engine.test.md
````markdown
# tests/engine.test.ts

_No extracted symbols in this file._
````

## File: graft/tests/helpers.md
````markdown
# tests/helpers.ts

- makeEntity · function · L21-L28 — function makeEntity(overrides: Partial<z.input<typeof EntitySchema>> & { id: string }): Entity
- makeAction · function · L30-L37 — function makeAction(overrides: Partial<z.input<typeof ActionSchema>> & { id: string }): Action
- makeCcp · function · L39-L51 — function makeCcp( overrides: Partial<z.input<typeof CriticalControlPointSchema>> & { id: string } ): CriticalControlPoint
````

## File: graft/tests/ingredient.test.md
````markdown
# tests/ingredient.test.ts

_No extracted symbols in this file._
````

## File: graft/tests/recipe.test.md
````markdown
# tests/recipe.test.ts

_No extracted symbols in this file._
````

## File: graft/tests/thermal.test.md
````markdown
# tests/thermal.test.ts

_No extracted symbols in this file._
````

## File: graft/INDEX.md
````markdown
# graft — repo map

Small markdown nodes summarising this repo. `grep` any term, symbol, or
filename here, or run `graft ask "<task>"`. Each node carries prose plus exact
`file:line`; open a source file only to edit the named span.

The same graph is queryable as MCP tools (`graft_find_code`, `graft_find_all`,
`graft_trace_calls`, `graft_file_api`, `graft_repo_map`) where a host exposes them, and
as the `graft` CLI everywhere else. Edges — who calls what — live only in the
graph, not in these files: `graft callers <symbol>` is the only way to read them.

## Files

29 per-file wiring cards mirror the source tree under `graft/` (21 carry extracted symbols). They are deliberately not enumerated here —
`grep` a symbol or `find`/`ls` a filename under `graft/` to land on the card for that file.
````

## File: .claude/helpers/graft-hooks.cjs
````javascript
#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { execFileSync } = require('child_process');
const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const BAKED = "/home/felix/.nvm/versions/node/v24.18.0/lib/node_modules/@nanonets/graft/dist/claude";

// The dist/claude dir of @nanonets/graft resolved from a base whose node_modules is searched.
function fromPkg(base) {
  try {
    const pkg = require.resolve('@nanonets/graft/package.json', { paths: [base] });
    return path.join(path.dirname(pkg), 'dist', 'claude');
  } catch { return null; }
}

// The global node_modules dir per npm (handles Homebrew/Windows/volta). Queried on demand.
function globalRoot() {
  try {
    const root = execFileSync('npm', ['root', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], shell: process.platform === 'win32' }).trim();
    return root || null;
  } catch { return null; /* npm unavailable */ }
}

function candidates() {
  const out = [];
  if (BAKED) out.push(BAKED);
  const local = fromPkg(dir); if (local) out.push(local);
  const legacy = fromPkg(path.join(path.dirname(process.execPath), '..', 'lib')); if (legacy) out.push(legacy);
  const gr = globalRoot(); if (gr) out.push(path.join(gr, '@nanonets', 'graft', 'dist', 'claude'));
  return out;
}

function entry(name) {
  for (const d of candidates()) {
    const f = path.join(d, name);
    if (fs.existsSync(f)) return f;
  }
  return path.join(dir, 'dist', 'claude', name); // last-ditch; import will no-op if absent
}

import(pathToFileURL(entry("hooks.js")).href).then((m) => m.main(process.argv[2])).catch(() => { /* graft unavailable — no-op */ });
````

## File: .claude/helpers/graft-statusline.cjs
````javascript
#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { execFileSync } = require('child_process');
const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const BAKED = "/home/felix/.nvm/versions/node/v24.18.0/lib/node_modules/@nanonets/graft/dist/claude";

// The dist/claude dir of @nanonets/graft resolved from a base whose node_modules is searched.
function fromPkg(base) {
  try {
    const pkg = require.resolve('@nanonets/graft/package.json', { paths: [base] });
    return path.join(path.dirname(pkg), 'dist', 'claude');
  } catch { return null; }
}

// The global node_modules dir per npm (handles Homebrew/Windows/volta). Queried on demand.
function globalRoot() {
  try {
    const root = execFileSync('npm', ['root', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], shell: process.platform === 'win32' }).trim();
    return root || null;
  } catch { return null; /* npm unavailable */ }
}

function candidates() {
  const out = [];
  if (BAKED) out.push(BAKED);
  const local = fromPkg(dir); if (local) out.push(local);
  const legacy = fromPkg(path.join(path.dirname(process.execPath), '..', 'lib')); if (legacy) out.push(legacy);
  const gr = globalRoot(); if (gr) out.push(path.join(gr, '@nanonets', 'graft', 'dist', 'claude'));
  return out;
}

function entry(name) {
  for (const d of candidates()) {
    const f = path.join(d, name);
    if (fs.existsSync(f)) return f;
  }
  return path.join(dir, 'dist', 'claude', name); // last-ditch; import will no-op if absent
}

import(pathToFileURL(entry("statusline.js")).href).then((m) => m.main()).catch(() => { /* graft unavailable — no-op */ });
````

## File: .claude/settings.json
````json
{
  "statusLine": {
    "type": "command",
    "command": "node \"${CLAUDE_PROJECT_DIR:-.}/.claude/helpers/graft-statusline.cjs\""
  },
  "subagentStatusLine": {
    "type": "command",
    "command": "node \"${CLAUDE_PROJECT_DIR:-.}/.claude/helpers/graft-statusline.cjs\""
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR:-.}/.claude/helpers/graft-hooks.cjs\" post-edit",
            "timeout": 10000
          }
        ]
      },
      {
        "matcher": "Bash|mcp__graft__",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR:-.}/.claude/helpers/graft-hooks.cjs\" tool-savings",
            "timeout": 8000
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR:-.}/.claude/helpers/graft-hooks.cjs\" prompt",
            "timeout": 15000
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR:-.}/.claude/helpers/graft-hooks.cjs\" session-start",
            "timeout": 8000
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR:-.}/.claude/helpers/graft-hooks.cjs\" stop",
            "timeout": 8000
          }
        ]
      }
    ]
  },
  "footerLinksRegexes": [
    "graft/[\\w./-]+\\.md"
  ],
  "permissions": {
    "allow": [
      "Bash(graft:*)",
      "Bash(npx graft:*)",
      "Bash(graft-dev:*)",
      "Bash(node dist/cli.js:*)"
    ]
  }
}
````

## File: data/actions/chili.json
````json
{
  "id": "chili",
  "verb": "CHILI",
  "names": {
    "en": "Season with chili flakes",
    "es": "Añadir guindilla"
  },
  "requiredTools": [],
  "requiredTargetCapability": "isSeasonable",
  "validTargetKinds": [
    "ingredient"
  ],
  "requiredIngredientCapabilities": [
    "isSpicySeasoning"
  ],
  "parameters": [
    {
      "id": "timing",
      "names": {
        "en": "Timing relative to cooking",
        "es": "Momento respecto a la cocción"
      },
      "required": false,
      "allowedValues": [
        "before_cooking",
        "during_cooking",
        "after_cooking"
      ]
    }
  ],
  "outputs": {
    "addsTag": "chili_seasoned",
    "spawnsTargetByproducts": false
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "Third instance of the same SALT-shaped seasoning verb (see pepper.json's notes for why this stays a separate verb rather than one generalized SEASON action). verb: 'CHILI' rather than a single standard English cooking verb — 'to chili' isn't idiomatic the way 'to salt'/'to pepper' are — kept as a plain, consistent action id/verb pair anyway (this schema's verb field is a stable machine token, not required to be a dictionary verb; see names.en for the actual human-readable phrase).",
    "timingNote": "Capsaicin (chili's heat compound) is fat/oil-soluble and fairly heat-stable compared to pepper's aromatic terpenes — chili added early to a step that includes oil (e.g. frying) has time to actually infuse its heat through the dish (the same isAromaticSource/INFUSE mechanism garlic-oil-potatoes.json already uses, just not yet wired for chili — see garlicReuseNote-style open-extension pattern), while chili added at the very end reads as more of a surface garnish. Purely informational here, same limits as every other timing-style parameter in this vocabulary."
  },
  "verification": {
    "method": "manual_confirmation",
    "description": "No reliable sensor check for 'properly seasoned with chili' in this vocabulary — taste isn't modeled at all",
    "confidence": "low"
  },
  "hazards": [
    {
      "type": "irritant",
      "severity": "low",
      "note": "Capsaicin can irritate eyes/skin/mucous membranes on contact — real even for flaked, not fresh, chili; wash hands before touching your face"
    }
  ],
  "retrySafe": true
}
````

## File: data/actions/pepper.json
````json
{
  "id": "pepper",
  "verb": "PEPPER",
  "names": {
    "en": "Pepper",
    "es": "Añadir pimienta"
  },
  "requiredTools": [],
  "requiredTargetCapability": "isSeasonable",
  "validTargetKinds": [
    "ingredient"
  ],
  "requiredIngredientCapabilities": [
    "isPepperySeasoning"
  ],
  "parameters": [
    {
      "id": "timing",
      "names": {
        "en": "Timing relative to cooking",
        "es": "Momento respecto a la cocción"
      },
      "required": false,
      "allowedValues": [
        "before_cooking",
        "during_cooking",
        "after_cooking"
      ]
    }
  ],
  "outputs": {
    "addsTag": "peppered",
    "spawnsTargetByproducts": false
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "Same shape as data/actions/salt.json on purpose (outputs.addsTag not transformedState, same requiredTargetCapability, same timing parameter) — closed 2026-08-13 as the first concrete instance of 'port the same seasoning logic to another seasoning,' deliberately WITHOUT generalizing into one parameter-driven SEASON verb: ActionOutputsSchema.addsTag has no addsTagFromParameter counterpart to transformedStateFromParameter (same fixed-vs-parameter-driven limitation LEARNINGS.md 2026-08-12 already documents for FRY's doneness), and requiredIngredientCapabilities only checks presence, never identifies WHICH specific instance satisfied it — so there'd be no way to know which literal tag to add even with that engine feature. Building that generalization is flagged as a real, separate, still-open piece of work (see LEARNINGS.md 2026-08-13), not attempted here; duplicating SALT's shape for PEPPER (and CHILI) is the honest, engine-unchanged answer for now.",
    "timingNote": "Same real chemistry as salt.json's timingNote applies here too (osmosis/surface-drying is about salt specifically, not pepper — pepper doesn't draw moisture out the way salt does), but timing still matters for a DIFFERENT reason: pepper's aromatic compounds degrade under prolonged heat, so pepper added at the START of a long cook loses more pungency than pepper added at the END — the opposite practical advice from salt's 'salt early for better browning.' Still purely informational here, same limits as fry.json's parameters: this records what was asked for, it does not make FRY's outcome depend on it."
  },
  "verification": {
    "method": "manual_confirmation",
    "description": "No reliable sensor check for 'properly peppered' in this vocabulary — taste isn't modeled at all",
    "confidence": "low"
  },
  "hazards": [],
  "retrySafe": true
}
````

## File: data/actions/simmer.json
````json
{
  "id": "simmer",
  "verb": "SIMMER",
  "names": {
    "en": "Simmer",
    "es": "Cocer a fuego lento"
  },
  "requiredTools": [
    "pot"
  ],
  "requiredTargetCapability": "isSimmerable",
  "validTargetKinds": [
    "ingredient"
  ],
  "requiredIngredientCapabilities": [
    "isBoilingMedium"
  ],
  "parameters": [
    {
      "id": "waterTempC",
      "names": {
        "en": "Water temperature",
        "es": "Temperatura del agua"
      },
      "required": false,
      "numericRange": {
        "unit": "celsius",
        "min": 85,
        "max": 96
      }
    },
    {
      "id": "durationSeconds",
      "names": {
        "en": "Duration",
        "es": "Duración"
      },
      "required": false,
      "numericRange": {
        "unit": "seconds",
        "min": 60,
        "max": 2400
      }
    },
    {
      "id": "yolkDoneness",
      "names": {
        "en": "Yolk doneness",
        "es": "Punto de la yema"
      },
      "required": false,
      "allowedValues": [
        "soft",
        "medium",
        "hard"
      ]
    },
    {
      "id": "heatSource",
      "names": {
        "en": "Heat source",
        "es": "Fuente de calor"
      },
      "required": false,
      "allowedValues": [
        "gas",
        "vitro",
        "wood"
      ]
    }
  ],
  "outputs": {
    "transformedState": "boiled",
    "spawnsTargetByproducts": false
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "A real, distinct technique from BOIL (data/actions/boil.json), not that verb with a milder adjective: water held at a bare simmer (gentle, occasional bubbles) rather than a rolling boil. requiredTools/requiredIngredientCapabilities are identical to BOIL's (same pot, same water-as-medium check) — the two verbs differ in the target temperature band and in the mechanical gentleness that band buys, not in equipment.",
    "sharedTransformedStateNote": "outputs.transformedState is 'boiled' — the SAME string BOIL produces — deliberately, not a separate 'simmered' state. A simmered potato and a boiled potato are the same dish; a simmered egg and a boiled egg are the same dish. Inventing a distinct 'simmered' state here would (1) misrepresent a process difference as an outcome difference, the same category error infuse.json's safetyNote and boil.json's heatSourceNote both warn against elsewhere in this vocabulary, and (2) silently break egg.json's statePrerequisites ('peel'/'shock' both require 'boiled') and potato.json's ('cut' requires 'peeled', chained after boiling in some recipes) for anything cooked via SIMMER instead of BOIL — those prerequisites are correct exactly because the resulting entity really is in the same physical state either way. This mirrors boil.json's own startMethod parameter (cold_start vs. boiling_start — also a real technique difference producing the identical resulting state), just promoted to its own verb rather than a parameter because real recipe text (and Cooklang authoring, CLAUDE.md's 'Cooklang interoperability' pillar) genuinely uses 'simmer' as its own word, unlike 'cold start'.",
    "waterTempCNote": "85-96°C, deliberately capped below BOIL's implicit ~100°C ceiling (water.json's boilingPointC) — a real, physically distinct band, not an arbitrary subdivision of the same range poach.json already covers. This is the same non-enforcement pattern as poach.json's waterTempC: informational, read by no branching logic in engine.ts (no thermalModel is attached to egg_cooking.json, the CCP this references — see engine.ts's applyAction, the D/z-value computation only activates when a CCP declares one). Recorded for provenance/planning, not consumed as a safety input, same caveat poach.json's own parameterNotes already states for the identical field.",
    "whyPerTarget": "Potato: a rolling boil's turbulence knocks whole/halved potatoes against the pot and each other, which can crack skins, break up starchy exteriors, and cloud the cooking water with released starch — standard advice for whole boiled potatoes (e.g. for a tortilla or potato salad, where intact pieces matter) is a gentle simmer, not a hard boil. Egg: the same turbulence is what actually cracks eggshells during cooking far more often than thermal shock alone — ties directly to egg.json's crackContainmentNote (what happens once a crack occurs) by addressing the more preventable cause (why one occurs in the first place). Neither claim is asserted as unique to SIMMER's existence — a cook can already hold a BOIL at a low simmer by turning the heat down — this action exists to give that real, commonly-issued instruction ('simmer, don't boil, the potatoes/eggs') its own name in the vocabulary rather than requiring it be expressed as BOIL plus an unstated aside.",
    "heatSourceNote": "Same informational field and allowedValues as boil.json's heatSource, but the CONTROL CHALLENGE it names is more load-bearing here than for BOIL: holding water in an 85-96°C band without creeping back up to a rolling boil is exactly the scenario src/heat-source.ts's controlPrecision and manualPositioningRelevance fields were written to describe ('how precisely a cook can hold a target temperature/simmer once there' — that file's own top doc comment, written 2026-08-13 before this action existed). Concretely: vitro's real thermal lag (responseSpeed: 'slow') actually helps hold a stable simmer once dialed in; wood fire's coarse, highly_variable output (data/heat-sources/wood_fire.json) makes a stable simmer the hardest of the three to maintain by dial alone, which is precisely why manualPositioningRelevance is 'high' for wood — moving the pot to a cooler part of the fire is often the only real fine control available. Still not modeled numerically here (see heat-source.ts's own stated depth limit); named accurately rather than pretending SIMMER's own parameters already account for it.",
    "yolkDonenessNote": "Identical parameter/allowedValues to boil.json's, deliberately — a soft/medium/hard-boiled egg cooked at a gentle simmer instead of a rolling boil is still evaluated against the exact same src/egg-doneness.ts EGG_BOIL_DONENESS seconds-range table (that table's timings were derived assuming boiling_start, gently-simmering water in the first place — see boil.json's startMethodNote — not a rolling boil, so this is actually the MORE literally accurate technique for those numbers, not an approximation of them).",
    "haccpNote": "criticalControlPointsByAction.simmer on egg.json points at the identical 'egg_cooking' CCP boil/fry/poach already use — Salmonella kill-time depends on internal temperature and hold duration, not on how turbulently the water around it moved to get there, so reusing the same CCP is the physically correct choice, not a shortcut."
  },
  "verification": {
    "method": "visual",
    "description": "Water shows small, gentle, occasional bubbles rising — not the vigorous, continuous turbulence of a rolling boil — maintained for at least durationSeconds",
    "confidence": "medium"
  },
  "hazards": [
    {
      "type": "hot_liquid",
      "severity": "high",
      "note": "Simmering water is still ~85-96°C — splash/scald risk, same as BOIL"
    }
  ],
  "retrySafe": true
}
````

## File: data/ccps/egg_cooking.json
````json
{
  "id": "egg_cooking",
  "names": {
    "en": "Egg cooking (Salmonella)",
    "es": "Cocción de huevo (Salmonella)"
  },
  "instantaneousC": 71,
  "heldC": 63,
  "heldSeconds": 15,
  "pathogen": "Salmonella spp.",
  "advisoryOnly": true,
  "source": "USDA FoodSafety.gov 'Safe Minimum Internal Temperature Chart' (egg dishes: 160°F / 71°C, instantaneous) — https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperature. heldC/heldSeconds (145°F / 63°C for 15 seconds) is the FDA Food Code §3-401.11(A) time-temperature-equivalence figure widely cited for shell eggs prepared for immediate service. advisoryOnly: true because the FDA Food Code (§3-603.11) explicitly recognizes eggs cooked to order with a still-runny yolk as a permitted 'increased risk' practice requiring a consumer advisory, not a banned one.",
  "metadata": {
    "note": "Two-point simplification, not the Food Code's full multi-point (temperature, time) table — treat instantaneousC/heldC as verified anchors from the sources above, not a reconstruction of every intermediate point on that curve.",
    "coagulationReferenceC": {
      "eggWhite": [62, 65],
      "eggYolk": [65, 70],
      "note": "Standard food-science figures (ovalbumin/ovotransferrin denaturation ranges, e.g. as summarized in Harold McGee, On Food and Cooking) for when white vs. yolk visually set — informational context for why a 'soft' egg is possible below the CCP at all, not itself a safety threshold."
    }
  }
}
````

## File: data/ccps/egg_pasteurization_liquid.json
````json
{
  "id": "egg_pasteurization_liquid",
  "names": {
    "en": "Liquid egg pasteurization (already separated, stays raw)",
    "es": "Pasteurización de huevo líquido (ya separado, queda crudo)"
  },
  "instantaneousC": 71,
  "heldC": 60,
  "heldSeconds": 210,
  "pathogen": "Salmonella spp.",
  "advisoryOnly": false,
  "source": "60°C (140°F) for 3.5 minutes (210s) is the commonly-cited USDA-regulated minimum pasteurization requirement for liquid whole egg product (9 CFR Part 590 / FDA egg products standards) — a real, regulated figure, not an estimate. Flagged explicitly: this repo has not independently verified the exact regulated combination specifically for separated YOLK alone (as opposed to whole liquid egg) against the primary regulatory text — yolk's higher fat content generally provides somewhat more thermal protection, so a yolk-specific regulated combination may differ slightly. Verify against 9 CFR 590 / FDA egg products standards directly before production use.",
  "thermalModel": {
    "referenceTempC": 60,
    "referenceHoldSeconds": 210,
    "zValueC": 4.5,
    "validityCondition": "Valid ONLY because the target here is already-separated, liquid egg yolk in a shallow water bath — thin, no insulating shell, reaches bath temperature quickly. NOT reused for egg.json's in-shell case (see egg_pasteurization_raw.json) — applying this same model against water-bath temperature for a whole shelled egg would understate the required time; see thermal.ts's ThermalInactivationModelSchema doc comment.",
    "source": "z-value ~4.5°C is a commonly-cited representative figure in food-science literature for Salmonella thermal inactivation kinetics in egg products — flagged with the same confidence caveat as the source field above: verify against a primary source before production use, not independently re-derived here."
  },
  "metadata": {
    "shellLagFinding": "Computed check, not asserted: requiredHoldSeconds(this model, 57°C) = 210 × 10^((60-57)/4.5) ≈ 975s (~16.2 min). egg_pasteurization_raw.json's actual in-shell empirical figure at the SAME 57°C is 3900s (65 min) — almost exactly 4x longer. That ~4x gap is consistent with real heat-penetration lag through the shell (the yolk doesn't actually reach 57°C the instant the water bath does) — a genuine, computed illustration of why the two CCPs in this repo are NOT interchangeable, not just a stated rule.",
    "note": "Two-point simplification pattern retained (instantaneousC/heldC/heldSeconds) alongside the new thermalModel for backward compatibility with any consumer that doesn't look at thermalModel — the two are meant to agree at heldC/heldSeconds (they do, by construction: thermalModel.referenceTempC/referenceHoldSeconds equal heldC/heldSeconds here)."
  }
}
````

## File: data/ccps/egg_pasteurization_raw.json
````json
{
  "id": "egg_pasteurization_raw",
  "names": {
    "en": "In-shell egg pasteurization (stays raw)",
    "es": "Pasteurización de huevo en cáscara (queda crudo)"
  },
  "instantaneousC": 71,
  "heldC": 57,
  "heldSeconds": 3900,
  "pathogen": "Salmonella spp.",
  "advisoryOnly": false,
  "source": "instantaneousC (71°C) is the same USDA FoodSafety.gov figure as egg_cooking.json, included because CriticalControlPointSchema requires one, but it is NOT usable for this process — reaching it would cook the egg, defeating the entire point. heldC/heldSeconds (57°C / ~65 minutes) is a commonly-cited figure in food-science / extension literature for in-shell pasteurization that keeps the egg raw-textured (the process popularized academically at Kansas State University and used commercially by e.g. Davidson's Safest Choice eggs) — flagged explicitly: this repo has NOT independently verified the exact published minutes against a primary source, and exact commercial process parameters vary/are sometimes proprietary. Verify against a primary food-safety-authority source before relying on this for an actual production process.",
  "metadata": {
    "note": "advisoryOnly: false, unlike egg_cooking.json's runny-yolk case. A cooked-but-runny egg is an FDA-recognized 'increased risk, disclosed' practice a diner can knowingly accept. Serving raw egg to someone (a child, by name, per the request that motivated this file) with NO pasteurization step at all is not that — there is no equivalent 'disclosed and accepted' framing for silently skipping the one mitigation this process exists to provide, so a shortfall here is a hard reject regardless of SafetyPolicy.mode, not something even a human operator's warning-and-continue path should wave through by default.",
    "whyNotJustUseEggCooking": "egg_cooking.json's 63°C/15s or 71°C-instant points would cook/set the yolk — incompatible with a process whose whole purpose is keeping the egg raw. This is a genuinely different point on the FDA Food Code's real time-temperature curve, not a stricter or looser version of the same one; see thermal.ts's doc comment on why that schema only captures two anchor points, not the full curve — this CCP is a third, separate anchor for a different use case."
  }
}
````

## File: data/entities/black_pepper.json
````json
{
  "id": "black_pepper",
  "kind": "ingredient",
  "names": {
    "en": "Black pepper",
    "es": "Pimienta negra"
  },
  "aggregationState": "solid",
  "structure": {
    "composite": false,
    "components": []
  },
  "composition": {
    "nutrientsPer100g": {
      "water_g": 10.5,
      "carbohydrate_g": 64,
      "protein_g": 10.4
    },
    "citation": {
      "source": "USDA FoodData Central (fdc.nal.usda.gov), spices, pepper, black",
      "confidence": "standard_reference",
      "note": "Same caveat as potato.json/garlic.json — this repo has not looked up the exact current FDC entry/ID to confirm the precise values."
    }
  },
  "possibleStates": ["whole", "cracked", "ground"],
  "possibleTags": [],
  "allowedTransformations": ["crush"],
  "producedByproducts": [],
  "capabilities": {
    "isCrushable": true,
    "isSeasoning": true,
    "isPepperySeasoning": true,
    "isWashable": false,
    "isChoppable": false
  },
  "sensory": {
    "taste": ["pungent", "bitter"],
    "aroma": ["woody", "citrusy"],
    "texture": ["hard"],
    "color": "black"
  },
  "cooklang": {
    "canonicalToken": "pimienta_negra",
    "spiceLock": true
  },
  "metadata": {
    "commonName": "black peppercorns",
    "notes": "Modeled starting from WHOLE peppercorns, not pre-ground, on purpose — the same reasoning garlic.json applies to peeling: the more common real starting point for someone actually cooking, and it's the one that lets a genuine technique distinction (see flavorChemistryNote) be represented at all. No thermophysical block: unlike salt.json (a pure, well-characterized compound), black pepper is a complex plant material never heated to a phase-change point in this vocabulary's actions — a density/conductivity figure would be recalled-approximate at best and isn't consumed by anything here (no CCP, no thermal-model use), so it's omitted rather than filled with an unused placeholder number, same reasoning garlic_peel.json's metadata gives for skipping composition/thermophysical entirely.",
    "capabilityNote": "isPepperySeasoning (not the generic isSeasoning) is what data/actions/pepper.json actually checks via requiredIngredientCapabilities — see salt.json's capabilityNote for why the generic flag alone isn't specific enough once more than one seasoning entity exists. isSeasoning stays true here too, for the separate 'is this a seasoning at all' question.",
    "flavorChemistryNote": "Source: Harold McGee, \"On Food and Cooking\" (rev. 2004), spices chapter — not re-verified against a primary source this session, recalled with reasonable confidence as well-established. Black pepper's bite comes from piperine, an alkaloid concentrated in the outer layer of the dried berry — it's volatile aromatic compounds (terpenes), not piperine itself, that oxidize/evaporate fastest once ground, which is the real, specific mechanism behind 'always use freshly ground/cracked pepper' being standard advice rather than folklore: pre-ground pepper isn't unsafe or non-pungent, it's measurably less aromatic within days to weeks of grinding. This is exactly the same shape of fact CUT's shape parameter and CRUSH's fineness parameter don't otherwise carry any notion of 'time since prepared' for — not modeled here either (no shelf-life/staleness mechanic exists anywhere in this repo yet), flagged rather than implied to already be captured just because 'whole' is now a representable starting state."
  }
}
````

## File: data/entities/bowl.json
````json
{
  "id": "bowl",
  "kind": "tool",
  "names": {
    "en": "Bowl",
    "es": "Bol"
  },
  "aggregationState": "solid",
  "structure": {
    "composite": false,
    "components": []
  },
  "possibleStates": ["clean", "dirty"],
  "allowedTransformations": [],
  "producedByproducts": [],
  "capabilities": {
    "isWashable": true
  },
  "metadata": {
    "notes": "Minimal tool entity, added so data/actions/beat.json's requiredTools reference resolves — same minimal-tool precedent as knife.json/mixer.json. Deliberately distinct from 'mixer': beating eggs with a fork/whisk in a bowl is a different, lower-tech operation than blending in mixer.json's electric mixer, and — unlike MIX — is naturally controllable by degree (a few strokes vs. thoroughly whipped), which is what data/actions/beat.json's 'intensity' parameter captures."
  }
}
````

## File: data/entities/chili_flakes.json
````json
{
  "id": "chili_flakes",
  "kind": "ingredient",
  "names": {
    "en": "Dried chili flakes",
    "es": "Copos de guindilla"
  },
  "aggregationState": "granular",
  "structure": {
    "composite": false,
    "components": []
  },
  "composition": {
    "nutrientsPer100g": {
      "water_g": 8,
      "carbohydrate_g": 57,
      "protein_g": 12
    },
    "citation": {
      "source": "USDA FoodData Central (fdc.nal.usda.gov), spices, pepper, red or cayenne — the closest standard FDC entry to a generic crushed dried chili flake product",
      "confidence": "commonly_cited_unverified",
      "note": "Lower confidence tier than potato.json/garlic.json/black_pepper.json's citations on purpose: 'chili flakes' is not one botanically precise ingredient the way NaCl or a specific vegetable is — commercial products sold as chili/red pepper flakes are made from many different Capsicum cultivars/blends with genuinely different composition and heat, so this figure is a representative stand-in, not a value for A specific product."
    }
  },
  "possibleStates": ["dry"],
  "possibleTags": [],
  "allowedTransformations": [],
  "producedByproducts": [],
  "capabilities": {
    "isSeasoning": true,
    "isSpicySeasoning": true,
    "isWashable": false,
    "isChoppable": false,
    "isCrushable": false
  },
  "sensory": {
    "taste": ["pungent"],
    "aroma": ["smoky", "earthy"],
    "texture": ["dry", "flaky"],
    "color": "red"
  },
  "cooklang": {
    "canonicalToken": "guindilla",
    "spiceLock": true
  },
  "metadata": {
    "commonName": "crushed red pepper flakes",
    "notes": "Modeled as an already-flaked, ready-to-use product (allowedTransformations: [], isCrushable: false), not whole dried chilies — unlike black_pepper.json's whole-peppercorn starting point, there's no single common 'crush a whole dried chili with a mortar' home-kitchen step this repo's CRUSH verb should represent generically (deseeding, toasting, and grinding whole dried chilies is a real technique but a more involved, recipe-specific one, not the default 'add heat' action) — flages are the more honest common starting point for a generic seasoning verb the way this repo models SALT/PEPPER. A whole-dried-chili entity/technique remains a genuine, unbuilt gap if a specific recipe ever needs it, not something faked here.",
    "capabilityNote": "isSpicySeasoning (not the generic isSeasoning) is what data/actions/chili.json actually checks via requiredIngredientCapabilities — same reasoning as black_pepper.json's isPepperySeasoning and salt.json's isSaltySeasoning.",
    "flavorChemistryNote": "Chili heat comes from capsaicinoids (mainly capsaicin), measured on the Scoville scale — a genuinely enormous real range (roughly 100-500 SHU for a mild bell-pepper-adjacent product up to 1,000,000+ SHU for a superhot cultivar), unlike black pepper's piperine content, which varies far less between common peppercorn products. This entity intentionally represents ONE common product (crushed red pepper flakes, roughly cayenne-range, often cited around 30,000-50,000 SHU) rather than a parametrized heat level — a real, separate axis this schema doesn't model (no 'heatSHU' field anywhere), flagged rather than collapsed into a single number this entity can't actually guarantee across every real product sold under this name. Capsaicin is also the same 'pungent' trigeminal/chemesthetic channel as garlic's allicin and pepper's piperine (see SensoryPropertiesSchema's doc comment, ingredient.ts), not a taste-bud response — consistent with both those entities' notes, not a new claim invented here."
  }
}
````

## File: data/entities/egg_shell.json
````json
{
  "id": "egg_shell",
  "kind": "ingredient",
  "names": {
    "en": "Egg shell",
    "es": "Cáscara de huevo"
  },
  "aggregationState": "solid",
  "structure": {
    "composite": false,
    "components": []
  },
  "composition": {
    "chemicalFormula": "CaCO3"
  },
  "possibleStates": ["raw"],
  "allowedTransformations": [],
  "producedByproducts": [],
  "byproductsByAction": {},
  "capabilities": {},
  "sensory": {
    "texture": ["brittle"],
    "color": "off-white"
  },
  "metadata": {
    "isWaste": true,
    "reusable": false,
    "producedBy": ["peel", "separate"],
    "notes": "The one byproduct common to both of egg.json's spawning actions — PEEL (shell off a boiled egg) and SEPARATE (cracking a raw egg) — hence it's egg.json's flat producedByproducts fallback, with byproductsByAction only overriding SEPARATE to add egg_yolk + egg_white on top. Unlike potato_peel.json, marked non-reusable: no fry/mix-equivalent reuse path modeled for it."
  }
}
````

## File: data/entities/garlic_peel.json
````json
{
  "id": "garlic_peel",
  "kind": "ingredient",
  "names": {
    "en": "Garlic skin",
    "es": "Piel de ajo"
  },
  "aggregationState": "solid",
  "structure": {
    "composite": false,
    "components": []
  },
  "possibleStates": ["raw"],
  "allowedTransformations": [],
  "producedByproducts": [],
  "capabilities": {},
  "sensory": {
    "texture": ["papery", "brittle"],
    "color": "off-white"
  },
  "metadata": {
    "isWaste": true,
    "reusable": false,
    "producedBy": ["peel"],
    "notes": "Byproduct entity spawned when 'peel' is applied to garlic.json (see EntitySchema.producedByproducts on garlic) — same producedBy convention as potato_peel.json/egg_shell.json. Unlike potato_peel.json, no fry/mix reuse path: papery garlic skin isn't a real reuse candidate the way potato peel (crisps) or a stock-simmered offcut would be, so allowedTransformations/capabilities are left empty rather than invented."
  }
}
````

## File: data/entities/knife.json
````json
{
  "id": "knife",
  "kind": "tool",
  "names": {
    "en": "Knife",
    "es": "Cuchillo"
  },
  "aggregationState": "solid",
  "structure": {
    "composite": false,
    "components": []
  },
  "possibleStates": ["clean", "dirty", "dull", "sharp"],
  "allowedTransformations": [],
  "producedByproducts": [],
  "capabilities": {
    "isWashable": true
  },
  "metadata": {
    "notes": "Minimal tool entity, added only so data/actions/peel.json's requiredTools reference resolves. Not fully modeled (no thermophysical/sensory data — tools don't need them the way ingredients do)."
  }
}
````

## File: data/entities/mixer.json
````json
{
  "id": "mixer",
  "kind": "tool",
  "names": {
    "en": "Mixer",
    "es": "Batidora"
  },
  "aggregationState": "solid",
  "structure": {
    "composite": false,
    "components": []
  },
  "possibleStates": ["clean", "dirty", "on", "off"],
  "allowedTransformations": [],
  "producedByproducts": [],
  "capabilities": {
    "isWashable": true
  },
  "metadata": {
    "notes": "Minimal tool entity, added only so data/actions/mix.json's requiredTools reference resolves. Same minimal-tool precedent as knife.json/pan.json."
  }
}
````

## File: data/entities/mortar.json
````json
{
  "id": "mortar",
  "kind": "tool",
  "names": {
    "en": "Mortar and pestle",
    "es": "Mortero"
  },
  "aggregationState": "solid",
  "structure": {
    "composite": false,
    "components": []
  },
  "possibleStates": ["clean", "dirty"],
  "allowedTransformations": [],
  "producedByproducts": [],
  "capabilities": {
    "isWashable": true
  },
  "metadata": {
    "notes": "Minimal tool entity, added so data/actions/crush.json and emulsify.json's requiredTools reference resolves — same minimal-tool precedent as knife.json/mixer.json/bowl.json. Deliberately distinct from those: a mortar is what makes handmade alioli handmade — no electric mixer/blender substitutes for it in the traditional technique this entity exists to model (see emulsify.json's notes)."
  }
}
````

## File: data/entities/oven.json
````json
{
  "id": "oven",
  "kind": "tool",
  "names": {
    "en": "Oven",
    "es": "Horno"
  },
  "aggregationState": "solid",
  "structure": {
    "composite": false,
    "components": []
  },
  "possibleStates": ["off", "preheating", "hot"],
  "allowedTransformations": [],
  "producedByproducts": [],
  "capabilities": {},
  "metadata": {
    "notes": "Minimal tool entity, added so bake.json's requiredTools reference resolves. No isWashable asserted — an oven isn't washed the way a knife/pan/pot is; left unasserted rather than forced false."
  }
}
````

## File: data/entities/pan.json
````json
{
  "id": "pan",
  "kind": "tool",
  "names": {
    "en": "Pan",
    "es": "Sartén"
  },
  "aggregationState": "solid",
  "structure": {
    "composite": false,
    "components": []
  },
  "possibleStates": ["clean", "dirty", "hot", "cold"],
  "allowedTransformations": [],
  "producedByproducts": [],
  "capabilities": {
    "isWashable": true
  },
  "metadata": {
    "notes": "Minimal tool entity, added only so data/actions/fry.json's requiredTools reference resolves. Not fully modeled (no thermophysical data yet), same as knife.json."
  }
}
````

## File: data/entities/pot.json
````json
{
  "id": "pot",
  "kind": "tool",
  "names": {
    "en": "Pot",
    "es": "Olla"
  },
  "aggregationState": "solid",
  "structure": {
    "composite": false,
    "components": []
  },
  "possibleStates": ["clean", "dirty"],
  "allowedTransformations": [],
  "producedByproducts": [],
  "capabilities": {
    "isWashable": true
  },
  "metadata": {
    "notes": "Minimal tool entity, added so boil.json's requiredTools reference resolves. Same minimal-tool precedent as knife.json/pan.json/mixer.json."
  }
}
````

## File: scripts/ask.ts
````typescript
import { join } from "node:path";
import { loadActions, loadRecipes } from "../src/registry.ts";
import { answerAboutParameter } from "../src/query.ts";

/**
 * A real query interface, not a demo of one — usage:
 *   npx tsx scripts/ask.ts <actionId> <parameterId>
 * e.g. npx tsx scripts/ask.ts emulsify oilAdditionRate
 *
 * Prints ONLY what's actually in data/*.json — allowedValues, whether the
 * parameter is state-determining or informational, every metadata note that
 * mentions it, and every real recipe that has used it. No generated prose.
 */

const [actionId, parameterId] = process.argv.slice(2);
if (!actionId || !parameterId) {
  console.error("Usage: npx tsx scripts/ask.ts <actionId> <parameterId>");
  process.exit(1);
}

const root = join(import.meta.dirname, "..");
const actions = loadActions(join(root, "data", "actions"));
const recipes = loadRecipes(join(root, "data", "recipes"));

const answer = answerAboutParameter(actions, recipes, actionId, parameterId);
if (!answer) {
  console.error(`No action "${actionId}" with parameter "${parameterId}" found.`);
  process.exit(1);
}

console.log(`${answer.actionVerb}.${answer.parameterId}`);
if (answer.allowedValues) console.log(`  allowedValues: ${answer.allowedValues.join(" | ")}`);
if (answer.numericRange) console.log(`  numericRange: ${answer.numericRange.min}-${answer.numericRange.max} ${answer.numericRange.unit}`);
console.log(`  required: ${answer.required}`);
console.log(`  stateDetermining: ${answer.stateDetermining} ${answer.stateDetermining ? "" : "(informational only — recorded, not enforced)"}`);

if (answer.relevantNotes.length > 0) {
  console.log(`\n  Domain knowledge (metadata.*, cited in-file):`);
  for (const note of answer.relevantNotes) {
    console.log(`  [${note.key}]\n    ${note.text}\n`);
  }
}

if (answer.recipeUsages.length > 0) {
  console.log(`  Real recipe usage:`);
  for (const usage of answer.recipeUsages) {
    console.log(`  - ${usage.recipeNameEn} (${usage.recipeId}), step ${usage.stepIndex}: ${answer.parameterId} = ${usage.value ?? "(not set)"}`);
  }
} else {
  console.log(`  No recipe in data/recipes/ currently sets this parameter.`);
}
````

## File: scripts/boil-egg-heat-sources.ts
````typescript
import { join } from "node:path";
import { loadEntities, loadHeatSources } from "../src/registry.ts";
import { estimatedPreheatSeconds } from "../src/heat-source.ts";
import { EGG_BOIL_DONENESS } from "../src/egg-doneness.ts";

/**
 * Capability test for the 2026-08-13 "how does temperature and time in the
 * egg work? how long on gas/vitro/wood? if I tell a robot medium boiled, I
 * want it to understand it" conversation. Proves two things concretely
 * rather than just asserting them in doc comments:
 *   1. Preheat TIME differs meaningfully by heat source (a real, computed
 *      number, not a vague "wood is slower").
 *   2. The boiling POINT itself does NOT — same 100C target for all three,
 *      pulled from the same water.json value, not re-typed per source.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const heatSources = loadHeatSources(join(root, "data", "heat-sources"));

const water = entities.get("water")!;
const boilingPointC = water.thermophysical!.boilingPointC!;
const specificHeat = water.thermophysical!.specificHeatJPerKgK!;

const potWaterMassKg = 1.5; // ~1.5L for a small pot of eggs, a realistic home quantity
const startTempC = 4; // refrigerator-cold water

console.log(`Water: ${potWaterMassKg}kg, starting at ${startTempC}°C, boiling point ${boilingPointC}°C (sea level).\n`);

console.log("Time to reach a boil, by heat source (this is what actually differs):");
for (const id of ["gas", "vitro", "wood_fire"]) {
  const source = heatSources.get(id)!;
  const seconds = estimatedPreheatSeconds(potWaterMassKg, startTempC, boilingPointC, source);
  const minutes = (seconds / 60).toFixed(1);
  console.log(
    `  ${source.names.en.padEnd(45)} ~${seconds.toFixed(0)}s (${minutes} min) — ` +
      `${source.typicalPowerWattsRange.min}-${source.typicalPowerWattsRange.max}W @ ` +
      `${source.thermalEfficiencyPercentRange.min}-${source.thermalEfficiencyPercentRange.max}% efficiency, ` +
      `manual positioning: ${source.manualPositioningRelevance}`
  );
}

console.log(`\nBut the TARGET TEMPERATURE is identical regardless of heat source — always ${boilingPointC}°C at sea level:`);
for (const id of ["gas", "vitro", "wood_fire"]) {
  const source = heatSources.get(id)!;
  console.log(`  ${source.names.en}: boils at ${boilingPointC}°C (read from water.json once, not re-derived per source)`);
}

console.log("\nOnce boiling, yolk doneness (this part is the same regardless of what got the water there):");
for (const entry of EGG_BOIL_DONENESS) {
  console.log(
    `  ${entry.yolkDoneness.padEnd(6)}: ${entry.durationSecondsRange.min}-${entry.durationSecondsRange.max}s ` +
      `(${(entry.durationSecondsRange.min / 60).toFixed(1)}-${(entry.durationSecondsRange.max / 60).toFixed(1)} min) — ${entry.description}`
  );
}

console.log(
  "\nSo: 'medium boiled egg on the wood fire' = wait ~" +
    `${estimatedPreheatSeconds(potWaterMassKg, startTempC, boilingPointC, heatSources.get("wood_fire")!).toFixed(0)}s for the water to boil, ` +
    `then boil the egg for ${EGG_BOIL_DONENESS.find((e) => e.yolkDoneness === "medium")!.durationSecondsRange.min}-` +
    `${EGG_BOIL_DONENESS.find((e) => e.yolkDoneness === "medium")!.durationSecondsRange.max}s — ` +
    "two genuinely separate numbers from two genuinely separate real facts, not one blended guess."
);

console.log(
  `\nsanity check — specificHeatJPerKgK read from water.json: ${specificHeat} J/(kg·K) (should be 4186)`
);
if (specificHeat !== 4186) {
  throw new Error("water.json's specificHeatJPerKgK drifted from the expected value — check the entity file");
}
````

## File: scripts/cook-egg-many-ways.ts
````typescript
import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Enumerates every distinct, finished way to cook an egg reachable with
 * exactly this kitchen: egg, olive oil, salt, water, a pan, and a bowl — no
 * pot, no knife, no mixer, no oven. That rules out BOIL (needs pot), PEEL
 * (needs knife + a boiled egg), and blending yolk/white in an electric
 * mixer; those are still in the vocabulary (data/entities/egg.json), just
 * not reachable from this specific kitchen.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));

const tools = new Set(["pan", "bowl"]);
const ingredients = new Set(["oil", "water"]);

function apply(instance: Instance, actionId: string): Instance {
  const action = actions.get(actionId);
  if (!action) throw new Error(`Unknown action "${actionId}"`);
  const result = applyAction(instance, action, entities, tools, undefined, ingredients);
  if (result.destroyed) {
    // The useful result of a destroysTarget action (CRACK, SEPARATE) is in
    // .spawned, not .instance — .instance is just the parent's state the
    // instant before it stopped existing, kept around for logging only.
    throw new Error(`${action.verb} destroys its target; use crack() instead of apply() for it.`);
  }
  console.log(`  ${action.verb}: "${instance.state}" -> "${result.instance.state}"`);
  return result.instance;
}

function crack(instance: Instance): Instance {
  const action = actions.get("crack")!;
  const result = applyAction(instance, action, entities, tools, undefined, ingredients);
  const cracked = result.spawned.find((s) => s.entityId === "egg_cracked");
  if (!cracked) throw new Error("Expected CRACK to spawn egg_cracked");
  console.log(`  CRACK: "${instance.state}" -> egg destroyed, spawned egg_cracked ("${cracked.state}")`);
  return cracked;
}

function freshEgg(): Instance {
  return { entityId: "egg", state: "raw", tags: [] };
}

function salt(instance: Instance): Instance {
  const action = actions.get("salt")!;
  const result = applyAction(instance, action, entities, tools, undefined, new Set(["salt"]));
  console.log(`  SALT: tags now [${result.instance.tags}]`);
  return result.instance;
}

function beat(instance: Instance, intensity: "lightly_beaten" | "beaten" | "well_beaten"): Instance {
  const action = actions.get("beat")!;
  const result = applyAction(instance, action, entities, tools, { intensity });
  console.log(`  BEAT (${intensity}): "${instance.state}" -> "${result.instance.state}"`);
  return result.instance;
}

console.log("1. Fried egg:");
const fried = apply(freshEgg(), "fry");

console.log("\n2. Fried egg, salted:");
const friedSalted = salt(apply(freshEgg(), "fry"));

console.log("\n3. Poached egg (cracked straight into simmering water, in the pan):");
const poached = apply(freshEgg(), "poach");

console.log("\n4. Poached egg, salted:");
const poachedSalted = salt(apply(freshEgg(), "poach"));

console.log("\n5. Plain / French omelette — crack, then optionally beat (more or less) in a bowl, then fry:");
const omeletteVariants: [string, Instance][] = [];
for (const intensity of ["none", "lightly_beaten", "beaten", "well_beaten"] as const) {
  for (const salted of [false, true]) {
    console.log(`\n  -- intensity: ${intensity}, salted: ${salted} --`);
    let egg = crack(freshEgg());
    if (intensity !== "none") egg = beat(egg, intensity);
    if (salted) egg = salt(egg);
    egg = apply(egg, "fry");
    omeletteVariants.push([`omelette, ${intensity}${salted ? ", salted" : ""}`, egg]);
  }
}

console.log("\n6. Scrambled eggs (crack, then scramble — BEAT applies here too, same as the omelette, omitted for brevity):");
const scrambled = apply(crack(freshEgg()), "scramble");

console.log("\n7. Scrambled eggs, salted:");
const scrambledSalted = salt(apply(crack(freshEgg()), "scramble"));

console.log("\nNot reachable with just this kitchen (still in the vocabulary, need more tools):");
console.log("  - Boiled / hard- or soft-boiled: BOIL needs a pot.");
console.log("  - Peeled boiled egg: PEEL needs a knife, and needs 'boiled' first.");
console.log("  - Separated yolk/white, blended in an electric mixer: MIX needs a mixer.");

console.log(`\n${4 + 8 + 2} finished dishes from {egg, oil, salt, water, pan, bowl}:`);
for (const [name, egg] of [
  ["fried", fried],
  ["fried, salted", friedSalted],
  ["poached", poached],
  ["poached, salted", poachedSalted],
  ...omeletteVariants,
  ["scrambled", scrambled],
  ["scrambled, salted", scrambledSalted],
] as [string, Instance][]) {
  console.log(`  ${name.padEnd(28)} state: "${egg.state}", tags: [${egg.tags}]`);
}
````

## File: scripts/egg-pasteurization.ts
````typescript
import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Demonstrates data/ccps/egg_pasteurization_raw.json's enforcement —
 * built after finding data/recipes/handmade-alioli-egg-yolk.json used raw
 * egg yolk with ZERO food-safety checking (see that recipe's
 * safetyHistory note). Unlike egg_cooking.json's runny-yolk CCP
 * (advisoryOnly: true — a human can knowingly accept it), this one is
 * advisoryOnly: false: a shortfall is a hard reject in EVERY SafetyPolicy
 * mode, not just autonomous. There's no "diner accepted the risk"
 * framing for silently serving under-pasteurized raw egg.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const tools = new Set(["pot"]);

function pasteurize(waterTempC: number, durationSeconds: number, policy?: { mode: "human" | "autonomous" }) {
  const action = actions.get("pasteurize")!;
  const instance: Instance = { entityId: "egg", state: "raw", tags: [] };
  const result = applyAction(
    instance,
    action,
    entities,
    tools,
    { waterTempC: String(waterTempC), durationSeconds: String(durationSeconds) },
    new Set(),
    ccps,
    policy
  );
  console.log(`  ${waterTempC}°C for ${durationSeconds}s (${policy?.mode ?? "human"} mode): tags [${result.instance.tags}]`);
  return result;
}

console.log("--- Adequate pasteurization (57°C, 65 min) — human mode ---");
pasteurize(57, 3900);

console.log("\n--- Adequate pasteurization — autonomous mode ---");
pasteurize(57, 3900, { mode: "autonomous" });

// 2400s (40 min) is deliberately WITHIN pasteurize.json's own declared
// numericRange (1800-7200s, a plausible-attempt sanity bound) but BELOW
// egg_pasteurization_raw.json's actual heldSeconds (3900s) — this exercises
// the CCP threshold check specifically, not just basic parameter bounds.
console.log("\n--- Plausible but insufficient (57°C, 40 min — within range, below CCP threshold) — human mode ---");
try {
  pasteurize(57, 2400);
  console.log("  UNEXPECTED: did not reject");
} catch (err) {
  console.log(`  REJECTED (human mode too — advisoryOnly: false, no 'diner accepts the risk' path here):`);
  console.log(`    ${(err as Error).message}`);
}

console.log("\n--- Same shortfall — autonomous mode ---");
try {
  pasteurize(57, 2400, { mode: "autonomous" });
  console.log("  UNEXPECTED: did not reject");
} catch (err) {
  console.log(`  REJECTED: ${(err as Error).message.split(".")[0]}.`);
}

console.log(
  "\nSame shortfall rejected in BOTH modes, unlike egg_cooking.json's runny-yolk case (egg-haccp.ts) — " +
    "egg_pasteurization_raw.json's advisoryOnly: false means there is no execution mode where this is " +
    "merely a warning. See that CCP's metadata.note for why."
);
````

## File: scripts/salted-boiled-potato.ts
````typescript
import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));

function apply(
  instance: Instance,
  actionId: string,
  availableTools: ReadonlySet<string>,
  availableIngredients?: ReadonlySet<string>
): Instance {
  const action = actions.get(actionId);
  if (!action) throw new Error(`Unknown action "${actionId}"`);
  const result = applyAction(instance, action, entities, availableTools, undefined, availableIngredients);
  console.log(
    `  ${action.verb}: state "${instance.state}" -> "${result.instance.state}", ` +
      `tags [${instance.tags}] -> [${result.instance.tags}]`
  );
  return result.instance;
}

let potato: Instance = { entityId: "potato", state: "raw", tags: [] };
potato = apply(potato, "wash", new Set(["knife"]));
potato = apply(potato, "peel", new Set(["knife"]));
potato = apply(potato, "boil", new Set(["pot"]), new Set(["water"]));
potato = apply(potato, "salt", new Set(), new Set(["salt"]));

console.log(`\nFinal: state = "${potato.state}", tags = [${potato.tags}]`);
console.log(
  potato.state === "boiled" && potato.tags.includes("salted")
    ? "Yes — boiled AND salted at once, held in two separate fields."
    : "Something's wrong: expected state 'boiled' with tag 'salted'."
);
````

## File: scripts/season-potato-three-ways.ts
````typescript
import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Capability test for the 2026-08-13 seasoning generalization: proves SALT/
 * PEPPER/CHILI actually run end-to-end against the same fried potato, not
 * just that the JSON files individually validate. Same "attempt a real
 * dish, watch it fail where it actually fails" method LEARNINGS.md/
 * ROADMAP.md already establish for capability tests generally.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));

function apply(instance: Instance, actionId: string, availableIngredients: ReadonlySet<string>): Instance {
  const action = actions.get(actionId);
  if (!action) throw new Error(`Unknown action "${actionId}"`);
  const result = applyAction(instance, action, entities, new Set(["knife", "pan"]), { timing: "after_cooking" }, availableIngredients);
  console.log(`  ${action.verb}: tags [${instance.tags.join(", ")}] -> [${result.instance.tags.join(", ")}]`);
  return result.instance;
}

function friedPotato(): Instance {
  let potato: Instance = { entityId: "potato", state: "raw", tags: [] };
  potato = applyAction(potato, actions.get("wash")!, entities, new Set(["knife", "pan"])).instance;
  potato = applyAction(potato, actions.get("peel")!, entities, new Set(["knife", "pan"])).instance;
  potato = applyAction(potato, actions.get("cut")!, entities, new Set(["knife", "pan"]), { shape: "diced" }).instance;
  potato = applyAction(potato, actions.get("fry")!, entities, new Set(["knife", "pan"]), {}, new Set(["oil"])).instance;
  return potato;
}

console.log("Salt only:");
const salted = apply(friedPotato(), "salt", new Set(["salt"]));

console.log("\nPepper only:");
const peppered = apply(friedPotato(), "pepper", new Set(["black_pepper"]));

console.log("\nChili only:");
const chilied = apply(friedPotato(), "chili", new Set(["chili_flakes"]));

console.log("\nAll three, same potato:");
let all = friedPotato();
all = apply(all, "salt", new Set(["salt"]));
all = apply(all, "pepper", new Set(["black_pepper"]));
all = apply(all, "chili", new Set(["chili_flakes"]));

console.log("\nCross-check: SALT must NOT accept black_pepper as a substitute (isSaltySeasoning, not generic isSeasoning):");
try {
  apply(friedPotato(), "salt", new Set(["black_pepper"]));
  throw new Error("SALT wrongly accepted black_pepper as a salt source — isSaltySeasoning check is not working");
} catch (err) {
  console.log(`  Correctly rejected: ${(err as Error).message}`);
}

console.log("\nFinal tags:");
console.log(`  salted:   [${salted.tags.join(", ")}]`);
console.log(`  peppered: [${peppered.tags.join(", ")}]`);
console.log(`  chilied:  [${chilied.tags.join(", ")}]`);
console.log(`  all three: [${all.tags.join(", ")}]`);
````

## File: scripts/separate-egg.ts
````typescript
import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance, type ExecutionResult } from "../src/engine.ts";

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const availableTools = new Set(["pot", "knife", "mixer"]);

function apply(
  instance: Instance,
  actionId: string,
  params?: Record<string, string>,
  availableIngredients?: ReadonlySet<string>
): ExecutionResult {
  const action = actions.get(actionId);
  if (!action) throw new Error(`Unknown action "${actionId}"`);
  console.log(`Applying ${action.verb} to ${instance.entityId} (state: "${instance.state}")`);
  const result = applyAction(instance, action, entities, availableTools, params, availableIngredients);
  console.log(
    result.destroyed
      ? `  -> ${instance.entityId} destroyed (conservation of mass) — was "${result.instance.state}" the instant before`
      : `  -> ${instance.entityId} is now "${result.instance.state}"`
  );
  for (const s of result.spawned) console.log(`  -> spawned ${s.entityId} (state: "${s.state}")`);
  return result;
}

console.log("--- Cracking a raw egg: separate ---");
const raw: Instance = { entityId: "egg", state: "raw", tags: [] };
const separated = apply(raw, "separate");
const yolk = separated.spawned.find((s) => s.entityId === "egg_yolk");
const white = separated.spawned.find((s) => s.entityId === "egg_white");
const shellFromSeparate = separated.spawned.find((s) => s.entityId === "egg_shell");
if (!yolk || !white || !shellFromSeparate) {
  throw new Error("Expected 'separate' to spawn egg_shell + egg_yolk + egg_white");
}
console.log("\nThe egg instance itself is gone — only its three children remain in the inventory.");

console.log("\n--- The yolk can be worked further, or not ---");
const beatenYolk = apply(yolk, "mix", undefined, new Set()).instance;
console.log(`(the white was left as-is: "${white.state}")`);

console.log("\n--- Peeling a *different*, boiled egg only sheds a shell — no yolk/white ---");
let boiledEgg: Instance = { entityId: "egg", state: "raw", tags: [] };
({ instance: boiledEgg } = apply(boiledEgg, "boil", undefined, new Set(["water"])));
const peeled = apply(boiledEgg, "peel");
const shellFromPeel = peeled.spawned.find((s) => s.entityId === "egg_shell");
if (!shellFromPeel || peeled.spawned.length !== 1) {
  throw new Error("Expected 'peel' to spawn only egg_shell, not egg_yolk/egg_white");
}

console.log("\nFinal state:");
console.log(`  egg_yolk: ${beatenYolk.state}`);
console.log(`  egg_white: ${white.state}`);
console.log(`  egg_shell (from separate): ${shellFromSeparate.state}`);
console.log(`  peeled egg: ${peeled.instance.state}`);
console.log(`  egg_shell (from peel): ${shellFromPeel.state}`);
````

## File: scripts/simmer-vs-boil.ts
````typescript
import { join } from "node:path";
import { loadEntities, loadActions, loadCcps, loadHeatSources } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Capability test for the 2026-08-13 SIMMER verb (data/actions/simmer.json,
 * ROADMAP.md "More common technique verbs"). Proves, rather than just
 * asserts in doc comments:
 *
 *   1. SIMMER reaches the SAME "boiled" state BOIL does — a simmered potato/
 *      egg is not a different dish, just a gentler process to the identical
 *      result (simmer.json's sharedTransformedStateNote).
 *   2. Because of (1), the existing statePrerequisites chain (PEEL/SHOCK
 *      require "boiled") works UNCHANGED on something cooked via SIMMER —
 *      no separate wiring needed, proven by actually running PEEL after
 *      SIMMER, not just asserting the state string matches.
 *   3. SIMMER's waterTempC band (85-96°C) is a real, distinct, ENFORCED
 *      range — a rolling-boil value like 100°C is rejected as out of range.
 *   4. The egg_cooking HACCP check applies IDENTICALLY to SIMMER as to
 *      BOIL/FRY/POACH (same CCP, same threshold, same shortfall behavior) —
 *      turbulence has no bearing on Salmonella kill-time.
 *   5. Potato is simmerable too (no CCP — no pathogen risk, same as its
 *      existing BOIL/FRY/BAKE capabilities).
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const heatSources = loadHeatSources(join(root, "data", "heat-sources"));

const tools = new Set(["pot", "knife"]);
const ingredients = new Set(["water"]);

console.log("=== 1. SIMMER produces the identical state BOIL does ===");
const boilAction = actions.get("boil")!;
const simmerAction = actions.get("simmer")!;
const boiledEgg = applyAction(
  { entityId: "egg", state: "raw", tags: [] },
  boilAction,
  entities,
  tools,
  { durationSeconds: "600" },
  ingredients,
  ccps
).instance;
const simmeredEgg = applyAction(
  { entityId: "egg", state: "raw", tags: [] },
  simmerAction,
  entities,
  tools,
  { durationSeconds: "600", waterTempC: "92" },
  ingredients,
  ccps
).instance;
console.log(`  BOIL:   raw -> "${boiledEgg.state}"`);
console.log(`  SIMMER: raw -> "${simmeredEgg.state}"`);
if (boiledEgg.state !== simmeredEgg.state) {
  throw new Error(`Expected SIMMER and BOIL to produce the same state, got "${simmeredEgg.state}" vs "${boiledEgg.state}"`);
}
console.log("  Same state, as intended — a simmered egg IS a boiled egg, just gentler to get there.\n");

console.log("=== 2. Downstream statePrerequisites (PEEL requires 'boiled') work unchanged after SIMMER ===");
const peelAction = actions.get("peel")!;
const peeledAfterSimmer = applyAction(simmeredEgg, peelAction, entities, tools, undefined, ingredients);
console.log(`  PEEL after SIMMER: "${simmeredEgg.state}" -> "${peeledAfterSimmer.instance.state}" (no error — statePrerequisites.peel is satisfied by SIMMER's output, no separate wiring needed)\n`);

console.log("=== 3. waterTempC's 85-96°C band is real and enforced (not the same range as a rolling boil) ===");
try {
  applyAction(
    { entityId: "egg", state: "raw", tags: [] },
    simmerAction,
    entities,
    tools,
    { durationSeconds: "600", waterTempC: "100" },
    ingredients,
    ccps
  );
  console.log("  UNEXPECTED: 100°C was accepted as a valid simmer temperature");
} catch (err) {
  console.log(`  REJECTED as expected — 100°C is a rolling boil, not a simmer:\n    ${(err as Error).message}`);
}

console.log("\n=== 4. HACCP applies identically to SIMMER as to BOIL (literally the same CCP, not a look-alike one) ===");
const egg = entities.get("egg")!;
const simmerCcp = egg.criticalControlPointsByAction["simmer"];
const boilCcp = egg.criticalControlPointsByAction["boil"];
console.log(`  egg.json: criticalControlPointsByAction.simmer = "${simmerCcp}", .boil = "${boilCcp}"`);
if (simmerCcp !== boilCcp) {
  throw new Error(`Expected SIMMER and BOIL to reference the identical CCP, got "${simmerCcp}" vs "${boilCcp}"`);
}
console.log(
  "  Same CCP id, not a separately-tuned one — turbulence has no bearing on Salmonella kill-time, so there's no\n" +
    "  physical basis for SIMMER to need its own threshold. (SIMMER's own durationSeconds floor, 60s, already\n" +
    "  clears egg_cooking's 15s hold requirement on any valid input — same as BOIL's identical floor.)\n"
);

console.log("=== 5. Potato is simmerable too (no CCP — no pathogen risk, same as BOIL/FRY/BAKE) ===");
const simmeredPotato = applyAction(
  { entityId: "potato", state: "peeled", tags: [] },
  simmerAction,
  entities,
  tools,
  { durationSeconds: "900", waterTempC: "90" },
  ingredients
).instance;
console.log(`  SIMMER: "peeled" -> "${simmeredPotato.state}"\n`);

console.log("=== 6. Why heat source matters more for SIMMER than for BOIL: holding a stable band, not just reaching one ===");
for (const id of ["gas", "vitro", "wood_fire"]) {
  const source = heatSources.get(id)!;
  console.log(
    `  ${source.names.en.padEnd(20)} controlPrecision: ${source.controlPrecision.padEnd(9)} manualPositioningRelevance: ${source.manualPositioningRelevance}`
  );
}
console.log(
  "  Wood fire's coarse control + high manual-positioning need is exactly why a stable simmer is hardest to hold\n" +
    "  there — src/heat-source.ts's controlPrecision/manualPositioningRelevance fields (written 2026-08-13, before\n" +
    "  SIMMER existed) already named this; SIMMER is the first action where it's actually the load-bearing fact."
);
````

## File: src/egg-doneness.ts
````typescript
import { z } from "zod";
import { CitationSchema, type Citation } from "./ingredient.ts";

/**
 * The concrete answer to "if I tell a robot I want my egg medium boiled, I
 * want it to understand it" — added 2026-08-13 directly in response to that
 * question. Before this file, `boil.json`'s `yolkDoneness` parameter
 * (soft/medium/hard) was a label with NO attached meaning anywhere in this
 * repo: informational only, explicitly documented as "doesn't drive
 * durationSeconds." That's still true here in one precise sense — this
 * file does not change `applyAction`/`engine.ts` at all (ROADMAP.md: "don't
 * worry about the engine yet") — but "medium boiled" now has a real, cited,
 * checkable number of seconds behind it for a human, a recipe author, or a
 * future intent-resolution layer to actually use, instead of nothing.
 *
 * This is deliberately NOT the engine automatically resolving "medium" into
 * a `durationSeconds` value — that's CONCEPT.md §14's LLM-intent-layer job
 * (see `fry.json`'s `internalTextureNote` for the same principle applied to
 * "omelette" vs. "tortilla francesa": OCR represents the distinction
 * precisely, it does not decide which one a customer meant). What THIS file
 * closes is the other half of that gap: an intent layer resolving "medium"
 * previously had nothing grounded to resolve it TO. Now it does.
 *
 * ASSUMPTIONS THIS TABLE MAKES, STATED EXPLICITLY (egg size and start
 * temperature both meaningfully shift real timing, and neither is tracked
 * anywhere in this repo yet — `egg.json` has no size field at all):
 * - A "large" egg (~50-60g), the most common size these figures are given
 *   for in the source material below — a medium or XL egg would need a
 *   real adjustment this repo doesn't compute.
 * - Starting from refrigerator-cold (~4°C), not room temperature.
 * - The BOILING-WATER-START method specifically: the egg goes into ALREADY
 *   boiling water, and the timer starts at that moment — matching
 *   `boil.json`'s own verification criterion ("water at or near 100°C
 *   maintained for at least durationSeconds"). This is `startMethod:
 *   "boiling_start"` on `boil.json`'s new parameter.
 * - Sea level (see `water.json`'s own altitude caveat — unaddressed here
 *   too, for the same reason).
 * - The egg is removed and shocked (`shock.json`) promptly at the end of
 *   `durationSeconds` — these figures assume carryover cooking is arrested,
 *   not left to keep cooking further (see `shock.json`'s
 *   carryoverCookingNote).
 *
 * COLD-START TIMING IS DELIBERATELY NOT INCLUDED HERE, NAMED AS A REAL GAP
 * RATHER THAN FAKED: for `startMethod: "cold_start"` (egg placed in COLD
 * water, heated together), total time is NOT simply
 * `estimatedPreheatSeconds` (heat-source.ts) plus one of the durations
 * below — the egg is already cooking gradually throughout the temperature
 * ramp, not just once boiling is reached, so the two numbers don't just
 * add. Modeling that properly needs integrating a cooking-rate function
 * over a temperature curve — real food-science territory this repo doesn't
 * attempt (matching `estimatedPreheatSeconds`'s own stated depth limit) —
 * flagged rather than silently offering a wrong number for that case.
 */
export const EggBoilDonenessSchema = z.object({
  yolkDoneness: z.enum(["soft", "medium", "hard"]),
  /** Real range, not a single number — even under these controlled
   *  assumptions, "medium" covers a genuine band of acceptable results, not
   *  one exact second count. */
  durationSecondsRange: z.object({ min: z.number().positive(), max: z.number().positive() }),
  description: z.string().min(1),
  citation: CitationSchema,
});
export type EggBoilDoneness = z.infer<typeof EggBoilDonenessSchema>;

const CITATION: Citation = {
  source:
    "Commonly cited large-egg, boiling-water-start timing guidelines convergent across cooking-science sources (e.g. J. Kenji López-Alt, Serious Eats \"The Food Lab\" egg-timing guide)",
  confidence: "commonly_cited_unverified",
  note:
    "Not verified against a primary source this session. soft's range (360-420s) was cross-checked for internal consistency, not independently derived: data/recipes/soft-boiled-egg.json already chose 390s for a 'soft'/jammy result before this table existed, and 390 falls inside this range rather than requiring reconciliation — a real check, not just an assertion, that the two were built from the same underlying common knowledge.",
};

export const EGG_BOIL_DONENESS: readonly EggBoilDoneness[] = [
  {
    yolkDoneness: "soft",
    durationSecondsRange: { min: 360, max: 420 },
    description: "Jammy to runny yolk, white fully set — the classic soft-boiled/mollet egg.",
    citation: CITATION,
  },
  {
    yolkDoneness: "medium",
    durationSecondsRange: { min: 480, max: 540 },
    description: "Yolk mostly set but still creamy/fudgy at the center, not chalky — the common 'jammy-firm' middle ground.",
    citation: CITATION,
  },
  {
    yolkDoneness: "hard",
    durationSecondsRange: { min: 660, max: 780 },
    description: "Yolk fully set throughout, no liquid/creamy center — classic hard-boiled.",
    citation: CITATION,
  },
];

/** Convenience lookup — throws rather than returning undefined, since every
 *  value of `boil.json`'s `yolkDoneness` allowedValues has an entry here by
 *  construction; a miss would mean the two drifted out of sync. */
export function eggBoilDonenessRange(yolkDoneness: "soft" | "medium" | "hard"): { min: number; max: number } {
  const entry = EGG_BOIL_DONENESS.find((e) => e.yolkDoneness === yolkDoneness);
  if (!entry) throw new Error(`No EGG_BOIL_DONENESS entry for "${yolkDoneness}" — out of sync with boil.json's allowedValues`);
  return entry.durationSecondsRange;
}
````

## File: src/query.ts
````typescript
import type { Action } from "./action.ts";
import type { RecipeScript } from "./recipe.ts";

/**
 * A real query interface over the structured domain data — the answer to
 * "I want this system to answer robot questions in the domain scope."
 * CONCEPT.md §14's boundary applies here exactly: an LLM's job is turning a
 * free-text question into a structured lookup (which action, which
 * parameter) — it is NOT this module's job to generate an answer from
 * general knowledge, and it's not what this returns. Everything below reads
 * only from the already-validated, already-cited JSON in data/ — the same
 * data ENGINE_INVARIANTS.md #10 already requires be authoritative over an
 * LLM for validation rules, now made queryable for domain QUESTIONS too, not
 * just execution.
 */

export interface ParameterAnswer {
  actionId: string;
  actionVerb: string;
  parameterId: string;
  /** Closed-set values, if this parameter uses allowedValues. */
  allowedValues?: string[];
  /** Continuous range, if this parameter uses numericRange. */
  numericRange?: { unit: string; min: number; max: number };
  required: boolean;
  /** Whether this parameter actually determines the resulting state
   *  (transformedStateFromParameter) or is informational only — a real,
   *  load-bearing distinction this whole codebase has been careful about;
   *  answering a domain question without surfacing this would overstate
   *  how much the system actually enforces. */
  stateDetermining: boolean;
  /** Every metadata.*Note field on the action whose key or text mentions
   *  this parameter id — the actual sourced domain knowledge, not a summary
   *  of it. */
  relevantNotes: { key: string; text: string }[];
  /** Every recipe step found using this action, with the value it chose for
   *  this parameter (if any) — real precedent, not a hypothetical. */
  recipeUsages: { recipeId: string; recipeNameEn: string; stepIndex: number; value: string | undefined }[];
}

export function answerAboutParameter(
  actions: Map<string, Action>,
  recipes: Map<string, RecipeScript>,
  actionId: string,
  parameterId: string
): ParameterAnswer | undefined {
  const action = actions.get(actionId);
  if (!action) return undefined;
  const param = action.parameters.find((p) => p.id === parameterId);
  if (!param) return undefined;

  const relevantNotes: { key: string; text: string }[] = [];
  for (const [key, value] of Object.entries(action.metadata)) {
    if (typeof value !== "string") continue;
    if (key.toLowerCase().includes(parameterId.toLowerCase()) || value.includes(parameterId)) {
      relevantNotes.push({ key, text: value });
    }
  }

  const recipeUsages: ParameterAnswer["recipeUsages"] = [];
  for (const recipe of recipes.values()) {
    recipe.sequence.forEach((step, stepIndex) => {
      if (step.actionId === actionId) {
        recipeUsages.push({
          recipeId: recipe.id,
          recipeNameEn: recipe.names.en,
          stepIndex,
          value: step.params[parameterId],
        });
      }
    });
  }

  return {
    actionId: action.id,
    actionVerb: action.verb,
    parameterId,
    allowedValues: param.allowedValues,
    numericRange: param.numericRange,
    required: param.required,
    stateDetermining: action.outputs.transformedStateFromParameter === parameterId,
    relevantNotes,
    recipeUsages,
  };
}
````

## File: tests/action.test.ts
````typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { ActionParameterSchema, ActionOutputsSchema, ActionSchema } from "../src/action.ts";

describe("ActionParameterSchema", () => {
  test("exactly one of allowedValues/numericRange is required", () => {
    assert.throws(() => ActionParameterSchema.parse({ id: "shape" }));
    assert.throws(() =>
      ActionParameterSchema.parse({
        id: "shape",
        allowedValues: ["diced"],
        numericRange: { unit: "s", min: 0, max: 1 },
      })
    );
    assert.doesNotThrow(() => ActionParameterSchema.parse({ id: "shape", allowedValues: ["diced"] }));
    assert.doesNotThrow(() =>
      ActionParameterSchema.parse({ id: "durationSeconds", numericRange: { unit: "s", min: 0, max: 1 } })
    );
  });

  test("required defaults to true", () => {
    const p = ActionParameterSchema.parse({ id: "shape", allowedValues: ["diced"] });
    assert.equal(p.required, true);
  });
});

describe("ActionOutputsSchema", () => {
  test("transformedState and transformedStateFromParameter are mutually exclusive", () => {
    assert.throws(() =>
      ActionOutputsSchema.parse({ transformedState: "peeled", transformedStateFromParameter: "shape" })
    );
    assert.doesNotThrow(() => ActionOutputsSchema.parse({ transformedState: "peeled" }));
    assert.doesNotThrow(() => ActionOutputsSchema.parse({ transformedStateFromParameter: "shape" }));
  });

  test("combinesInto is mutually exclusive with transformedState/transformedStateFromParameter", () => {
    assert.throws(() => ActionOutputsSchema.parse({ combinesInto: "tortilla_mixture", transformedState: "combined" }));
    assert.throws(() =>
      ActionOutputsSchema.parse({ combinesInto: "tortilla_mixture", transformedStateFromParameter: "shape" })
    );
    assert.doesNotThrow(() => ActionOutputsSchema.parse({ combinesInto: "tortilla_mixture" }));
  });

  test("spawnsTargetByproducts and destroysTarget default false", () => {
    const o = ActionOutputsSchema.parse({});
    assert.equal(o.spawnsTargetByproducts, false);
    assert.equal(o.destroysTarget, false);
  });
});

describe("ActionSchema", () => {
  const base = { id: "peel", verb: "PEEL", outputs: {} };

  test("names must include an 'en' entry", () => {
    assert.throws(() => ActionSchema.parse({ ...base, names: { es: "Pelar" } }));
    assert.doesNotThrow(() => ActionSchema.parse({ ...base, names: { en: "Peel" } }));
  });

  test("requiredTools/requiredIngredientCapabilities/parameters/hazards default to empty arrays", () => {
    const a = ActionSchema.parse({ ...base, names: { en: "Peel" } });
    assert.deepEqual(a.requiredTools, []);
    assert.deepEqual(a.requiredIngredientCapabilities, []);
    assert.deepEqual(a.parameters, []);
    assert.deepEqual(a.hazards, []);
    assert.deepEqual(a.validTargetKinds, ["ingredient"]);
  });
});
````

## File: tests/egg-doneness.test.ts
````typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { EGG_BOIL_DONENESS, eggBoilDonenessRange, EggBoilDonenessSchema } from "../src/egg-doneness.ts";

describe("EGG_BOIL_DONENESS", () => {
  test("has exactly one entry per boil.json yolkDoneness value, each schema-valid", () => {
    const ids = EGG_BOIL_DONENESS.map((e) => e.yolkDoneness);
    assert.deepEqual([...ids].sort(), ["hard", "medium", "soft"]);
    for (const entry of EGG_BOIL_DONENESS) {
      assert.doesNotThrow(() => EggBoilDonenessSchema.parse(entry));
    }
  });

  test("ranges are ordered and non-overlapping: soft < medium < hard", () => {
    const soft = eggBoilDonenessRange("soft");
    const medium = eggBoilDonenessRange("medium");
    const hard = eggBoilDonenessRange("hard");
    assert.ok(soft.max <= medium.min, "soft's range should end at or before medium's begins");
    assert.ok(medium.max <= hard.min, "medium's range should end at or before hard's begins");
  });

  test("eggBoilDonenessRange throws for an out-of-vocabulary value instead of returning undefined", () => {
    assert.throws(() => eggBoilDonenessRange("runny" as any));
  });

  test("cross-check against the real recipe: soft-boiled-egg.json's chosen 390s falls inside the 'soft' range", () => {
    // Not a coincidence to preserve silently — a real consistency check
    // between this table (added 2026-08-13) and a recipe authored before
    // it existed (LEARNINGS.md 2026-08-12's soft-boiled-egg.json).
    const soft = eggBoilDonenessRange("soft");
    const recipeChoiceSeconds = 390;
    assert.ok(recipeChoiceSeconds >= soft.min && recipeChoiceSeconds <= soft.max);
  });
});
````

## File: tests/engine.test.ts
````typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { applyAction, type Instance, type SafetyPolicy } from "../src/engine.ts";
import { makeEntity, makeAction, makeCcp } from "./helpers.ts";

const NO_TOOLS = new Set<string>();
const NO_INGREDIENTS = new Set<string>();
const NO_CCPS = new Map();

describe("applyAction — preconditions", () => {
  test("throws for an instance whose entity id isn't registered", () => {
    const action = makeAction({ id: "peel", requiredTargetCapability: "isPeelable" });
    const instance: Instance = { entityId: "ghost", state: "raw", tags: [] };
    assert.throws(
      () => applyAction(instance, action, new Map(), NO_TOOLS),
      /Unknown entity "ghost"/
    );
  });

  test("throws when the entity kind isn't a valid target for the action", () => {
    const knife = makeEntity({ id: "knife", kind: "tool" });
    const action = makeAction({ id: "peel", validTargetKinds: ["ingredient"] });
    const entities = new Map([["knife", knife]]);
    assert.throws(
      () => applyAction({ entityId: "knife", state: "raw", tags: [] }, action, entities, NO_TOOLS),
      /cannot target entity kind "tool"/
    );
  });

  test("enforces per-action statePrerequisites", () => {
    const potato = makeEntity({
      id: "potato",
      statePrerequisites: { cut: "peeled" },
    });
    const action = makeAction({ id: "cut", outputs: { transformedState: "diced" } });
    const entities = new Map([["potato", potato]]);

    assert.throws(
      () => applyAction({ entityId: "potato", state: "raw", tags: [] }, action, entities, NO_TOOLS),
      /requires "potato" to already be "peeled"/
    );

    const result = applyAction({ entityId: "potato", state: "peeled", tags: [] }, action, entities, NO_TOOLS);
    assert.equal(result.instance.state, "diced");
  });

  test("requiredTargetCapability: missing vs. explicit false both block, distinguishably", () => {
    const unasserted = makeEntity({ id: "rock" });
    const denied = makeEntity({ id: "bone", capabilities: { isPeelable: false } });
    const action = makeAction({ id: "peel", requiredTargetCapability: "isPeelable" });
    const entities = new Map([
      ["rock", unasserted],
      ["bone", denied],
    ]);

    assert.throws(
      () => applyAction({ entityId: "rock", state: "raw", tags: [] }, action, entities, NO_TOOLS),
      /but it is unasserted/
    );
    assert.throws(
      () => applyAction({ entityId: "bone", state: "raw", tags: [] }, action, entities, NO_TOOLS),
      /but it is explicitly false/
    );
  });

  test("requiredTools: throws when a required tool isn't on hand, passes when it is", () => {
    const potato = makeEntity({ id: "potato" });
    const action = makeAction({ id: "peel", requiredTools: ["peeler"] });
    const entities = new Map([["potato", potato]]);
    const instance: Instance = { entityId: "potato", state: "raw", tags: [] };

    assert.throws(
      () => applyAction(instance, action, entities, NO_TOOLS),
      /requires tool "peeler"/
    );
    assert.doesNotThrow(() => applyAction(instance, action, entities, new Set(["peeler"])));
  });

  test("requiredIngredientCapabilities checks presence of ANY qualifying ingredient, not a specific one", () => {
    const potato = makeEntity({ id: "potato" });
    const oil = makeEntity({ id: "oil", capabilities: { isFryingMedium: true } });
    const water = makeEntity({ id: "water", capabilities: { isFryingMedium: false } });
    const action = makeAction({ id: "fry", requiredIngredientCapabilities: ["isFryingMedium"] });
    const entities = new Map([
      ["potato", potato],
      ["oil", oil],
      ["water", water],
    ]);
    const instance: Instance = { entityId: "potato", state: "raw", tags: [] };

    assert.throws(
      () => applyAction(instance, action, entities, NO_TOOLS, {}, new Set(["water"])),
      /requires an available ingredient with capability "isFryingMedium"/
    );
    assert.doesNotThrow(() => applyAction(instance, action, entities, NO_TOOLS, {}, new Set(["water", "oil"])));
  });
});

describe("applyAction — parameters", () => {
  const entities = new Map([["potato", makeEntity({ id: "potato" })]]);
  const instance: Instance = { entityId: "potato", state: "raw", tags: [] };

  test("required allowedValues parameter: missing throws, invalid value throws, valid value passes", () => {
    const action = makeAction({
      id: "cut",
      parameters: [{ id: "shape", required: true, allowedValues: ["diced", "sliced"] }],
      outputs: { transformedStateFromParameter: "shape" },
    });

    assert.throws(() => applyAction(instance, action, entities, NO_TOOLS), /requires a "shape" parameter/);
    assert.throws(
      () => applyAction(instance, action, entities, NO_TOOLS, { shape: "julienned" }),
      /only diced, sliced are valid/
    );
    const result = applyAction(instance, action, entities, NO_TOOLS, { shape: "diced" });
    assert.equal(result.instance.state, "diced");
  });

  test("numericRange parameter: out-of-bounds and non-numeric both throw, in-range passes", () => {
    const action = makeAction({
      id: "fry",
      parameters: [{ id: "durationSeconds", required: false, numericRange: { unit: "s", min: 1, max: 600 } }],
      outputs: { transformedState: "fried" },
    });

    assert.throws(
      () => applyAction(instance, action, entities, NO_TOOLS, { durationSeconds: "9999" }),
      /expected a number between 1 and 600/
    );
    assert.throws(
      () => applyAction(instance, action, entities, NO_TOOLS, { durationSeconds: "not-a-number" }),
      /expected a number between 1 and 600/
    );
    assert.doesNotThrow(() => applyAction(instance, action, entities, NO_TOOLS, { durationSeconds: "30" }));
  });

  test("an optional parameter that's simply absent doesn't throw", () => {
    const action = makeAction({
      id: "fry",
      parameters: [{ id: "durationSeconds", required: false, numericRange: { unit: "s", min: 1, max: 600 } }],
      outputs: { transformedState: "fried" },
    });
    assert.doesNotThrow(() => applyAction(instance, action, entities, NO_TOOLS));
  });
});

describe("applyAction — outputs & conservation of mass", () => {
  test("addsTag is idempotent — re-running doesn't duplicate the tag", () => {
    const potato = makeEntity({ id: "potato", possibleTags: ["salted"] });
    const action = makeAction({ id: "salt", outputs: { addsTag: "salted" } });
    const entities = new Map([["potato", potato]]);

    const once = applyAction({ entityId: "potato", state: "raw", tags: [] }, action, entities, NO_TOOLS);
    assert.deepEqual(once.instance.tags, ["salted"]);

    const twice = applyAction(once.instance, action, entities, NO_TOOLS);
    assert.deepEqual(twice.instance.tags, ["salted"]);
  });

  test("spawnsTargetByproducts prefers byproductsByAction[action.id] over the flat producedByproducts fallback", () => {
    const egg = makeEntity({
      id: "egg",
      producedByproducts: ["egg_shell"],
      byproductsByAction: { separate: ["egg_shell", "egg_yolk", "egg_white"] },
    });
    const eggShell = makeEntity({ id: "egg_shell", possibleStates: ["raw"] });
    const eggYolk = makeEntity({ id: "egg_yolk", possibleStates: ["raw"] });
    const eggWhite = makeEntity({ id: "egg_white", possibleStates: ["raw"] });
    const entities = new Map([
      ["egg", egg],
      ["egg_shell", eggShell],
      ["egg_yolk", eggYolk],
      ["egg_white", eggWhite],
    ]);

    const peel = makeAction({ id: "peel", outputs: { spawnsTargetByproducts: true, destroysTarget: true } });
    const peeled = applyAction({ entityId: "egg", state: "boiled", tags: [] }, peel, entities, NO_TOOLS);
    assert.deepEqual(
      peeled.spawned.map((s) => s.entityId),
      ["egg_shell"],
      "PEEL should fall back to producedByproducts, not the separate-specific override"
    );

    const separate = makeAction({ id: "separate", outputs: { spawnsTargetByproducts: true, destroysTarget: true } });
    const separated = applyAction({ entityId: "egg", state: "raw", tags: [] }, separate, entities, NO_TOOLS);
    assert.deepEqual(
      separated.spawned.map((s) => s.entityId),
      ["egg_shell", "egg_yolk", "egg_white"]
    );
  });

  test("spawned byproducts inherit the parent's tags, filtered against the byproduct's own possibleTags", () => {
    const egg = makeEntity({ id: "egg", producedByproducts: ["egg_yolk", "egg_shell"] });
    // egg_yolk can carry "pasteurized" onward; egg_shell can't (not a
    // meaningful concept for a shell) — the filter must drop it there.
    const eggYolk = makeEntity({ id: "egg_yolk", possibleStates: ["raw"], possibleTags: ["pasteurized"] });
    const eggShell = makeEntity({ id: "egg_shell", possibleStates: ["raw"], possibleTags: [] });
    const entities = new Map([
      ["egg", egg],
      ["egg_yolk", eggYolk],
      ["egg_shell", eggShell],
    ]);
    const separate = makeAction({ id: "separate", outputs: { spawnsTargetByproducts: true, destroysTarget: true } });

    const result = applyAction(
      { entityId: "egg", state: "raw", tags: ["pasteurized"] },
      separate,
      entities,
      NO_TOOLS
    );
    const yolk = result.spawned.find((s) => s.entityId === "egg_yolk")!;
    const shell = result.spawned.find((s) => s.entityId === "egg_shell")!;
    assert.deepEqual(yolk.tags, ["pasteurized"]);
    assert.deepEqual(shell.tags, []);
  });

  test("destroysTarget marks the result destroyed, but still reports the pre-destruction instance for logging", () => {
    const egg = makeEntity({ id: "egg" });
    const entities = new Map([["egg", egg]]);
    const action = makeAction({ id: "crack", outputs: { destroysTarget: true, transformedState: "cracked" } });
    const result = applyAction({ entityId: "egg", state: "raw", tags: [] }, action, entities, NO_TOOLS);
    assert.equal(result.destroyed, true);
    assert.equal(result.instance.state, "cracked");
  });

  test("requiredSecondaryCapability: throws without a secondary instance, and when the secondary lacks the capability", () => {
    const potato = makeEntity({ id: "fried_potato" });
    const eggBad = makeEntity({ id: "flour" }); // no isCombinable
    const eggGood = makeEntity({ id: "beaten_egg", capabilities: { isCombinable: true } });
    const entities = new Map([
      ["fried_potato", potato],
      ["flour", eggBad],
      ["beaten_egg", eggGood],
    ]);
    const action = makeAction({
      id: "combine",
      requiredSecondaryCapability: "isCombinable",
      outputs: { combinesInto: "tortilla_mixture" },
    });
    const target: Instance = { entityId: "fried_potato", state: "fried", tags: [] };

    assert.throws(
      () => applyAction(target, action, entities, NO_TOOLS),
      /requires a secondary instance/
    );
    assert.throws(
      () =>
        applyAction(target, action, entities, NO_TOOLS, {}, NO_INGREDIENTS, NO_CCPS, undefined, {
          entityId: "flour",
          state: "raw",
          tags: [],
        }),
      /requires secondary capability "isCombinable"/
    );
  });

  test("combinesInto merges tags from BOTH instances (filtered), destroys both, spawns exactly one new instance", () => {
    const potato = makeEntity({ id: "fried_potato", possibleTags: ["salted"] });
    const egg = makeEntity({ id: "beaten_egg", capabilities: { isCombinable: true }, possibleTags: ["salted"] });
    const mixture = makeEntity({
      id: "tortilla_mixture",
      possibleStates: ["combined"],
      possibleTags: ["salted"],
    });
    const entities = new Map([
      ["fried_potato", potato],
      ["beaten_egg", egg],
      ["tortilla_mixture", mixture],
    ]);
    const action = makeAction({
      id: "combine",
      requiredSecondaryCapability: "isCombinable",
      outputs: { combinesInto: "tortilla_mixture" },
    });

    const result = applyAction(
      { entityId: "fried_potato", state: "fried", tags: ["salted"] },
      action,
      entities,
      NO_TOOLS,
      {},
      NO_INGREDIENTS,
      NO_CCPS,
      undefined,
      { entityId: "beaten_egg", state: "beaten", tags: [] }
    );

    assert.equal(result.destroyed, true);
    assert.equal(result.secondaryDestroyed, true);
    assert.equal(result.spawned.length, 1);
    assert.equal(result.spawned[0].entityId, "tortilla_mixture");
    assert.equal(result.spawned[0].state, "combined");
    assert.deepEqual(result.spawned[0].tags, ["salted"]);
  });
});

describe("applyAction — HACCP / CCP enforcement", () => {
  const eggEntity = makeEntity({ id: "egg_cracked", criticalControlPointsByAction: { fry: "egg_cooking" } });
  const entities = new Map([["egg_cracked", eggEntity]]);
  const fry = makeAction({
    id: "fry",
    parameters: [{ id: "durationSeconds", required: false, numericRange: { unit: "s", min: 0, max: 6000 } }],
    outputs: { transformedState: "fried" },
  });
  const instance: Instance = { entityId: "egg_cracked", state: "raw", tags: [] };

  test("CCP check is gated on durationSeconds being supplied at all", () => {
    const ccp = makeCcp({ id: "egg_cooking", heldSeconds: 60, advisoryOnly: false });
    const ccps = new Map([["egg_cooking", ccp]]);
    // No durationSeconds passed -> zero HACCP behavior, even though this
    // entity/action pair has a CCP wired up.
    const result = applyAction(instance, fry, entities, NO_TOOLS, {}, NO_INGREDIENTS, ccps);
    assert.deepEqual(result.warnings, []);
  });

  test("a non-advisory shortfall is a hard reject regardless of policy", () => {
    const ccp = makeCcp({ id: "egg_cooking", heldSeconds: 60, advisoryOnly: false });
    const ccps = new Map([["egg_cooking", ccp]]);
    assert.throws(
      () => applyAction(instance, fry, entities, NO_TOOLS, { durationSeconds: "10" }, NO_INGREDIENTS, ccps),
      /is below "egg_cooking"'s minimum hold/
    );
  });

  test("meeting or exceeding the threshold produces no warning and doesn't throw", () => {
    const ccp = makeCcp({ id: "egg_cooking", heldSeconds: 60, advisoryOnly: false });
    const ccps = new Map([["egg_cooking", ccp]]);
    const result = applyAction(instance, fry, entities, NO_TOOLS, { durationSeconds: "60" }, NO_INGREDIENTS, ccps);
    assert.deepEqual(result.warnings, []);
  });

  test("referencing a CCP id that isn't in the loaded ccps map throws a self-diagnosing error", () => {
    assert.throws(
      () => applyAction(instance, fry, entities, NO_TOOLS, { durationSeconds: "10" }, NO_INGREDIENTS, NO_CCPS),
      /references unknown CriticalControlPoint "egg_cooking".*was ccps not loaded/
    );
  });

  test("a NaN durationSeconds fails closed (throws) instead of silently skipping the check", () => {
    const ccp = makeCcp({ id: "egg_cooking", heldSeconds: 60, advisoryOnly: false });
    const ccps = new Map([["egg_cooking", ccp]]);
    // Bypass the numericRange parameter validation (which would itself
    // reject "abc") by targeting an action whose parameters[] doesn't
    // declare durationSeconds at all — isolates the CCP check's OWN guard.
    const undeclaredFry = makeAction({ id: "fry", outputs: { transformedState: "fried" } });
    assert.throws(
      () => applyAction(instance, undeclaredFry, entities, NO_TOOLS, { durationSeconds: "abc" }, NO_INGREDIENTS, ccps),
      /is not a valid number.*refusing to proceed/
    );
  });

  describe("advisoryOnly shortfalls under SafetyPolicy", () => {
    const ccp = makeCcp({ id: "egg_cooking", heldSeconds: 60, advisoryOnly: true });
    const ccps = new Map([["egg_cooking", ccp]]);
    const params = { durationSeconds: "10" };

    test("human mode (default): warns, does not throw", () => {
      const result = applyAction(instance, fry, entities, NO_TOOLS, params, NO_INGREDIENTS, ccps);
      assert.equal(result.warnings.length, 1);
      assert.match(result.warnings[0], /is below "egg_cooking"'s minimum hold/);
    });

    test("autonomous mode, no override: hard reject", () => {
      const policy: SafetyPolicy = { mode: "autonomous" };
      assert.throws(
        () => applyAction(instance, fry, entities, NO_TOOLS, params, NO_INGREDIENTS, ccps, policy),
        /no human present to accept this risk — rejected by default/
      );
    });

    test("autonomous mode, explicitly overridden for this CCP id: warns, does not throw", () => {
      const policy: SafetyPolicy = { mode: "autonomous", humanOverrides: new Set(["egg_cooking"]) };
      const result = applyAction(instance, fry, entities, NO_TOOLS, params, NO_INGREDIENTS, ccps, policy);
      assert.equal(result.warnings.length, 1);
      assert.match(result.warnings[0], /autonomous mode: proceeding on explicit human override/);
    });

    test("autonomous mode, override for a DIFFERENT CCP id: still hard reject", () => {
      const policy: SafetyPolicy = { mode: "autonomous", humanOverrides: new Set(["some_other_ccp"]) };
      assert.throws(
        () => applyAction(instance, fry, entities, NO_TOOLS, params, NO_INGREDIENTS, ccps, policy),
        /rejected by default/
      );
    });
  });

  test("thermalModel + waterTempC computes the required hold time instead of using the fixed heldSeconds anchor", () => {
    // referenceHoldSeconds=1000 @ 57°C, z=10°C -> at 67°C required drops to 100s.
    const ccp = makeCcp({
      id: "egg_cooking",
      heldC: 57,
      heldSeconds: 1000,
      advisoryOnly: false,
      thermalModel: {
        referenceTempC: 57,
        referenceHoldSeconds: 1000,
        zValueC: 10,
        validityCondition: "test fixture",
        source: "test fixture",
      },
    });
    const ccps = new Map([["egg_cooking", ccp]]);
    const poach = makeAction({
      id: "fry",
      parameters: [
        { id: "durationSeconds", required: false, numericRange: { unit: "s", min: 0, max: 6000 } },
        { id: "waterTempC", required: false, numericRange: { unit: "C", min: 0, max: 100 } },
      ],
      outputs: { transformedState: "fried" },
    });

    // 200s at 67°C: below the fixed 1000s anchor, but above the
    // temperature-adjusted 100s requirement -> should PASS, not throw.
    const result = applyAction(
      instance,
      poach,
      entities,
      NO_TOOLS,
      { durationSeconds: "200", waterTempC: "67" },
      NO_INGREDIENTS,
      ccps
    );
    assert.deepEqual(result.warnings, []);

    // Same 200s at the reference temp (57°C) needs the full 1000s -> throws.
    assert.throws(
      () =>
        applyAction(
          instance,
          poach,
          entities,
          NO_TOOLS,
          { durationSeconds: "200", waterTempC: "57" },
          NO_INGREDIENTS,
          ccps
        ),
      /is below "egg_cooking"'s minimum hold/
    );
  });
});
````

## File: tests/heat-source.test.ts
````typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { HeatSourceProfileSchema, estimatedPreheatSeconds, type HeatSourceProfile } from "../src/heat-source.ts";

function makeHeatSource(overrides: Partial<HeatSourceProfile> & { id: string }): HeatSourceProfile {
  return HeatSourceProfileSchema.parse({
    names: { en: overrides.id },
    typicalPowerWattsRange: { min: 1000, max: 1000 },
    thermalEfficiencyPercentRange: { min: 100, max: 100 },
    responseSpeed: "instant",
    controlPrecision: "precise",
    manualPositioningRelevance: "low",
    citation: { source: "test fixture", confidence: "commonly_cited_unverified" },
    ...overrides,
  });
}

describe("HeatSourceProfileSchema", () => {
  test("names must include an 'en' entry", () => {
    assert.throws(() => makeHeatSource({ id: "x", names: { es: "x" } as any }));
  });

  test("efficiency is bounded to 0-100", () => {
    assert.throws(() =>
      makeHeatSource({ id: "x", thermalEfficiencyPercentRange: { min: 50, max: 150 } })
    );
  });
});

describe("estimatedPreheatSeconds", () => {
  test("matches the textbook Q=mcΔT / P formula exactly for a clean, deterministic case", () => {
    // 1kg water, 20C -> 100C, 1000W at 100% efficiency, specific heat 4186 J/(kg*K).
    const source = makeHeatSource({ id: "ideal" });
    const seconds = estimatedPreheatSeconds(1, 20, 100, source, 4186);
    const expected = (1 * 4186 * 80) / 1000;
    assert.equal(seconds, expected);
  });

  test("throws when the target temperature isn't above the initial temperature", () => {
    const source = makeHeatSource({ id: "ideal" });
    assert.throws(() => estimatedPreheatSeconds(1, 100, 100, source), /must be above/);
    assert.throws(() => estimatedPreheatSeconds(1, 100, 20, source), /must be above/);
  });

  test("lower efficiency means more time, all else equal — a real physical ordering, not just a different number", () => {
    const efficient = makeHeatSource({ id: "efficient", thermalEfficiencyPercentRange: { min: 80, max: 80 } });
    const inefficient = makeHeatSource({ id: "inefficient", thermalEfficiencyPercentRange: { min: 20, max: 20 } });
    const fastTime = estimatedPreheatSeconds(1, 20, 100, efficient);
    const slowTime = estimatedPreheatSeconds(1, 20, 100, inefficient);
    assert.ok(slowTime > fastTime, "a less efficient heat source should take longer to reach the same target");
  });

  test("more water takes proportionally longer to reach the same target temperature", () => {
    const source = makeHeatSource({ id: "ideal" });
    const oneLiter = estimatedPreheatSeconds(1, 20, 100, source);
    const twoLiters = estimatedPreheatSeconds(2, 20, 100, source);
    assert.equal(twoLiters, oneLiter * 2);
  });
});
````

## File: tests/helpers.ts
````typescript
import { EntitySchema, type Entity } from "../src/ingredient.ts";
import { ActionSchema, type Action } from "../src/action.ts";
import { CriticalControlPointSchema, type CriticalControlPoint } from "../src/thermal.ts";
import type { z } from "zod";

/**
 * Minimal-but-valid builders for the three core schemas, so each test only
 * has to spell out the fields it actually cares about. Deliberately routed
 * through `.parse()` (not built as raw object literals) so a test failure
 * that stems from a bad fixture, rather than the code under test, fails
 * loudly at the schema boundary instead of silently passing malformed data
 * into `applyAction`.
 *
 * Typed against each schema's z.input (pre-default shape, e.g. `outputs:
 * {}` without spawnsTargetByproducts/destroysTarget filled in yet) rather
 * than its z.infer output type — a test fixture only supplies the fields it
 * cares about and lets Zod's own defaults fill the rest, same as every
 * data/*.json file does.
 */

export function makeEntity(overrides: Partial<z.input<typeof EntitySchema>> & { id: string }): Entity {
  return EntitySchema.parse({
    kind: "ingredient",
    names: { en: overrides.id },
    aggregationState: "solid",
    ...overrides,
  });
}

export function makeAction(overrides: Partial<z.input<typeof ActionSchema>> & { id: string }): Action {
  return ActionSchema.parse({
    verb: overrides.id.toUpperCase(),
    names: { en: overrides.id },
    outputs: {},
    ...overrides,
  });
}

export function makeCcp(
  overrides: Partial<z.input<typeof CriticalControlPointSchema>> & { id: string }
): CriticalControlPoint {
  return CriticalControlPointSchema.parse({
    names: { en: overrides.id },
    instantaneousC: 74,
    heldC: 57,
    heldSeconds: 60,
    pathogen: "Salmonella spp.",
    source: "test fixture — not a real citation",
    ...overrides,
  });
}
````

## File: tests/recipe.test.ts
````typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { RecipeInstanceSchema, RecipeScriptSchema } from "../src/recipe.ts";

describe("RecipeInstanceSchema", () => {
  test("quantity is optional — a recipe instance can still be named with no amount, unchanged from before quantity existed", () => {
    const i = RecipeInstanceSchema.parse({ id: "salt-1", entityId: "salt", state: "dry" });
    assert.equal(i.quantity, undefined);
    assert.deepEqual(i.tags, []);
  });

  test("quantity, when given, is validated as a real QuantitySchema shape (invalid kind rejected here too)", () => {
    const i = RecipeInstanceSchema.parse({
      id: "salt-1",
      entityId: "salt",
      state: "dry",
      quantity: { kind: "imprecise", descriptor: "pinch" },
    });
    assert.deepEqual(i.quantity, { kind: "imprecise", descriptor: "pinch" });

    assert.throws(() =>
      RecipeInstanceSchema.parse({
        id: "salt-1",
        entityId: "salt",
        state: "dry",
        quantity: { kind: "imprecise", descriptor: "a bit" },
      })
    );
  });
});

describe("RecipeScriptSchema", () => {
  const base = {
    id: "test_recipe",
    names: { en: "Test Recipe" },
    initialInventory: [{ id: "potato-1", entityId: "potato", state: "raw" }],
    sequence: [{ actionId: "wash", targetInstanceId: "potato-1" }],
  };

  test("requires at least one initialInventory item and one sequence step", () => {
    assert.doesNotThrow(() => RecipeScriptSchema.parse(base));
    assert.throws(() => RecipeScriptSchema.parse({ ...base, initialInventory: [] }));
    assert.throws(() => RecipeScriptSchema.parse({ ...base, sequence: [] }));
  });

  test("names must include an 'en' entry", () => {
    assert.throws(() => RecipeScriptSchema.parse({ ...base, names: { es: "Receta de Prueba" } }));
  });
});
````

## File: tests/thermal.test.ts
````typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { requiredHoldSeconds, CriticalControlPointSchema, type ThermalInactivationModel } from "../src/thermal.ts";
import { makeCcp } from "./helpers.ts";

describe("requiredHoldSeconds — D-value/z-value thermal death time model", () => {
  const model: ThermalInactivationModel = {
    referenceTempC: 57,
    referenceHoldSeconds: 1000,
    zValueC: 10,
    validityCondition: "test fixture",
    source: "test fixture",
  };

  test("at the reference temperature, returns exactly the reference hold time", () => {
    assert.equal(requiredHoldSeconds(model, 57), 1000);
  });

  test("one z-value hotter cuts the required time by a factor of 10", () => {
    assert.equal(requiredHoldSeconds(model, 67), 100);
  });

  test("one z-value colder multiplies the required time by 10", () => {
    assert.equal(requiredHoldSeconds(model, 47), 10000);
  });
});

describe("CriticalControlPointSchema", () => {
  test("names must include an 'en' entry", () => {
    assert.throws(() => makeCcp({ id: "x", names: { es: "x" } as unknown as Record<string, string> }));
  });

  test("advisoryOnly defaults to false", () => {
    const ccp = CriticalControlPointSchema.parse({
      id: "x",
      names: { en: "x" },
      instantaneousC: 74,
      heldC: 57,
      heldSeconds: 60,
      pathogen: "Salmonella spp.",
      source: "test fixture",
    });
    assert.equal(ccp.advisoryOnly, false);
  });

  test("a missing source is rejected — an unsourced threshold is exactly the failure mode this schema exists to prevent", () => {
    assert.throws(() =>
      CriticalControlPointSchema.parse({
        id: "x",
        names: { en: "x" },
        instantaneousC: 74,
        heldC: 57,
        heldSeconds: 60,
        pathogen: "Salmonella spp.",
      })
    );
  });
});
````

## File: .ignore
````
# graft's cards are gitignored but should stay greppable: ripgrep reads
# .ignore before .gitignore, so this re-admits the tree to search only.
!graft/
graft/.cache/
graft/.graph/
````

## File: .mcp.json
````json
{
  "mcpServers": {
    "graft": {
      "command": "graft",
      "args": [
        "mcp"
      ]
    }
  }
}
````

## File: CLAUDE_DEV_CTX.md
````markdown
# Open Culinary Runtime (OCR) — Claude Pro Programming Guide 🤖🍳

This document acts as the definitive development context and system prompt for **Claude Pro (or any advanced LLM/coding agent)**. It provides a complete conceptual blueprint, file map, validation specifications, and reference code architectures to enable the seamless generation, validation, and extension of the **Open Culinary Runtime (OCR)** ecosystem.

---

## 🧭 System Instructions (Copy-Paste to Claude's System Prompt)

```markdown
You are a Lead Software Engineer and Culinary Informatics Architect specializing in the Open Culinary Runtime (OCR) and OpenRecipe standards. 

Your objective is to help write, validate, and extend TypeScript and Python engines that treat recipes as deterministic, executable state machines using an Entity-Component-System (ECS) architecture rather than static text blocks.

### Core Architectural Pillars
1. **Entities ("What"):** Describe physical, reusable objects. Separates consumable ingredients (e.g., "potato") from reusable cookware or utensils (e.g., "frying-pan", "chef-knife").
2. **States ("Physical Conditions"):** Describe broad, observable physical conditions of an entity (e.g., "raw", "peeled", "chopped", "boiled", "liquid").
3. **Actions ("Changes"):** Describe physical transformations that act as transition boundaries, consuming inputs in State A and yielding outputs in State B.
4. **Parameters ("Culinary Details"):** Describe quantitative details modifying the physics, timing (seconds), or safety critical thresholds (HACCP) of a specific action.

### Strict Simulation Heuristics
- **Conservation of Mass & Entities:** When a step executes (e.g., "separate"), the parent entity is consumed/destroyed from the simulation inventory, and the disjoint child entities (e.g., "egg_yolk" and "egg_white") are spawned in its place.
- **Physical Feasibility Restrictions:** Prevent logically impossible state transitions. Block actions that violate the physics matrix (e.g., you cannot "peel" a potato that is already "boiled", and you cannot "chop" something that is "mashed" or "liquid").
- **HACCP Critical Control Points (CCPs):** Thermal steps must enforce safety thresholds (e.g., holding a minimum internal temperature of 135°F for at least 15 seconds).
- **Cooklang Interoperability:** Treat Cooklang as the primary human-writable interface. Maintain full backward-compatibility with custom scaling rules (multiplier factors) and spice locks (quantities prefixed with `=` do not scale linearly).
- **Schema.org Complement:** Treat Schema.org JSON-LD as a flat, lossy target for public search-engine indexation. Provide lossless conversions from rich, nested OCR JSONs to flat, readable string arrays.
```

---

## 📂 Repository File Map & Specifications

Claude should respect the following modular file layout when writing or updating code:

### 1. `ingredient.ts` (Core Entity & Ingestion Models)
Defines the vocabulary of things in the kitchen. 
- **`EntitySchema`:** Validates static entities, separating ingredients and tools.
- **`RecipeIngredientSchema`:** Handles instance portion sizes, quantities (fraction/decimal union), and localized translations.
- **`ParsedIngredientSchema`:** Handles temporary storage for unstructured regex parser runs before entity mapping.

### 2. `recipe-step.ts` (Execution Sequence & HACCP Safety)
Models the mechanical actions, states, and safety boundaries.
- **`EntityStateSchema`:** Captures an entity ID, active physical state, quantity, and unit.
- **`CriticalControlPointSchema`:** Tracks USDA-compliant HACCP thresholds (phases, critical temperature limits in Fahrenheit, and holding times).
- **`MechanicalActionSchema`:** Validates a step sequence, requiring an array of tools used, inputs consumed, and outputs generated.

### 3. `recipe.ts` (The Complete Compiled Script)
- **`RecipeScriptSchema`:** The overall container mapping initial inventory states (initial kitchen setup) and the linear execution sequence.

### 4. `nutrition-extension.ts` (Optional Pluggable Metadata)
- **`UsdaMealPatternContributionSchema`:** Maps school lunch nutritional ounce/cup equivalents (grains, protein, vegetables) to core ingredients without bloating the core spec.

---

## 🚀 Reference Code Architectures

Feed these exact implementations to Claude to ensure coding consistency:

### A. The Core Validation Engine (`ocr-engine.ts`)
```typescript
import { RecipeScript, EntityState, MechanicalAction } from './ocr-schema';

export interface ValidationError {
  stepId: string;
  verb: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  finalInventory: EntityState[];
}

const INVALID_TRANSITIONS: Record<string, string[]> = {
  boiled: ['raw', 'peeled'],
  fried: ['raw', 'peeled', 'boiled'],
  mashed: ['raw', 'peeled', 'chopped', 'sliced', 'diced', 'boiled'],
  liquid: ['raw', 'peeled', 'chopped', 'sliced', 'diced', 'boiled', 'mashed'],
};

export class OcrValidationEngine {
  private inventory: Map<string, EntityState> = new Map();

  constructor(initialInventory: EntityState[]) {
    for (const item of initialInventory) {
      this.inventory.set(item.entityId, { ...item });
    }
  }

  public validate(recipe: RecipeScript): ValidationResult {
    const errors: ValidationError[] = [];
    for (const step of recipe.sequence) {
      const stepErrors = this.validateStep(step);
      if (stepErrors.length > 0) {
        errors.push(...stepErrors);
      } else {
        this.applyStep(step);
      }
    }
    return {
      isValid: errors.length === 0,
      errors,
      finalInventory: Array.from(this.inventory.values()),
    };
  }

  private validateStep(step: MechanicalAction): ValidationError[] {
    const errors: ValidationError[] = [];

    // Pre-requisites & Requirements check
    if (step.requirements) {
      for (const req of step.requirements) {
        const invItem = this.inventory.get(req.entityId);
        if (!invItem) {
          errors.push({ stepId: step.id, verb: step.verb, message: `Missing entity: ${req.entityId} not in inventory.` });
          continue;
        }
        if (req.requiredState && invItem.state !== req.requiredState) {
          errors.push({ stepId: step.id, verb: step.verb, message: `State conflict: ${req.entityId} must be ${req.requiredState}, got ${invItem.state}.` });
        }
      }
    }

    // Input state transition logic check
    for (const input of step.inputs) {
      const invItem = this.inventory.get(input.entityId);
      if (!invItem) {
        errors.push({ stepId: step.id, verb: step.verb, message: `Execution failed: Input ${input.entityId} not available.` });
        continue;
      }

      const forbiddenNextStates = INVALID_TRANSITIONS[invItem.state] || [];
      if (forbiddenNextStates.includes(input.state)) {
        errors.push({
          stepId: step.id,
          verb: step.verb,
          message: `Forbidden transition: Cannot transform ${input.entityId} from ${invItem.state} to ${input.state}.`
        });
      }
    }
    return errors;
  }

  public applyStep(step: MechanicalAction): void {
    for (const input of step.inputs) {
      const invItem = this.inventory.get(input.entityId);
      if (invItem) {
        if (input.quantity && invItem.quantity !== undefined) {
          invItem.quantity -= input.quantity;
          if (invItem.quantity <= 0) this.inventory.delete(input.entityId);
        } else {
          this.inventory.delete(input.entityId);
        }
      }
    }
    for (const output of step.outputs) {
      const existing = this.inventory.get(output.entityId);
      if (existing) {
        existing.state = output.state;
        if (output.quantity && existing.quantity !== undefined) existing.quantity += output.quantity;
      } else {
        this.inventory.set(output.entityId, { ...output });
      }
    }
  }
}
```

### B. Bi-directional Compilers (`ocr-converter.ts`)
Must convert standard text formatting to structured Schema.org fields or parse inline Cooklang text tokens:
```typescript
import { IngredientModel } from './ocr-schema';

export function compileToSchemaOrgIngredient(ing: IngredientModel): string {
  if (ing.rawString) return ing.rawString;
  const parts: string[] = [];
  if (ing.quantity) parts.push(ing.quantity.toString());
  if (ing.unit) parts.push(ing.unit);
  parts.push(ing.name);
  let baseString = parts.join(" ");
  if (ing.preparation) baseString += `, ${ing.preparation}`;
  return baseString.trim();
}
```

---

## 🛠️ Direct Programming Assignments

Instruct Claude Pro to program the following active tasks:

### Assignment 1: Web Scraper Pipeline (Python / BeautifulSoup)
Have Claude write a Python parsing script that:
1. Ingests a raw recipe web URL, requests the page, and extracts `<script type="application/ld+json">`.
2. Parses the lossy Schema.org `recipeIngredient` strings and uses regex / NLP heuristics to tokenize them into `quantity`, `unit`, `name`, and `preparation`.
3. Auto-generates Cooklang text and compiles it into an executable OCR JSON script.

### Assignment 2: Mobile Reference App (React Native + Expo)
Have Claude design screens matching our 4-tab navigator specifications:
1. **Discover Screen:** Real-time search of local recipe folders with interactive cooking steps.
2. **Community Screen:** Feed with async `FormData` recipe post uploads and an active `onUploadProgress` hook.
3. **Meal Plan Screen:** Parsing and mapping `.menu` schedules.
4. **Profile Screen:** Handling JWT tokens with automatic logout when expired.

### Assignment 3: Home Assistant HACS Component (Python)
Have Claude program a custom Home Assistant platform that:
1. Interfaces with a local CookCLI server running on `http://localhost:9080`.
2. Creates sensors to track expiring food and depleted pantry items.
3. Automatically populates HA Calendar cards using parsed `.menu` file schedules.
````

## File: masideas.md
````markdown
Knowledge > Instructions

Ingredients know themselves.
Tools know themselves.
Actions know themselves.

Recipes should contain as little knowledge as possible.
3. Core Principles

Cada principio explicado.

Por ejemplo

Knowledge is immutable.

Instances are mutable.

Recipes are declarative.

Everything is replayable.

Everything is deterministic.

Unknown knowledge is allowed.
4. The World

Explicar qué existe.

Ingredient Types

Ingredient Instances

Actions

Transformations

Tools

Containers

Workstations

Environment

Particles

Recipes

Events

Todo con diagramas.

5. Knowledge Layers

Esta parte me gusta mucho.

Grandma Layer

↓

World Layer

↓

Scientific Layer

Grandma dice

"pela la patata"

World entiende

PEEL

requires:
knife

creates:
peeled potato
potato peel

Scientific layer sabe

skin removed

water decreases

surface changes

etc

Nunca al revés.

6. Ingredient Model

Aquí un documento enorme.

Identity

Structure

Composition

Capabilities

Possible States

Allowed Transformations

Produced Byproducts

Sensory Properties

Metadata
7. Actions

Una acción no es código.

Es conocimiento.

Ejemplo

PEEL

requires

knife

valid targets

vegetables

outputs

peeled object
waste

duration

variable

precision

optional

etc
8. States

No sólo

raw

fried

Sino

peeled

cut

broken

burned

crispy

cold

warm

hot

overcooked

salted

wet

dry
9. Transformations

Aquí es donde ocurre la magia.

No existen recetas.

Existen transformaciones.

egg

↓

break

↓

egg white
egg yolk
shell
10. Event System

Todo es Event Sourcing.

PICK_UP

DROP

CUT

MOVE

HEAT

WAIT

MIX


Nunca se guarda el estado.

Sólo eventos.

11. Timeline

Explicar

undo

redo

save

playback

ghost cooking

AI explanation

robot execution


Todo sale gratis gracias al timeline.

12. Recipe Model

La parte importante.

Una receta NO contiene

Step 1

Step 2

Step 3

Contiene

Goals

Constraints

Required Ingredients

Acceptable States

Serving

Optional Variants

Tolerance

Victory Conditions
13. Validation Engine

Cómo decide

Is this tortilla valid?

No compara texto.

Compara estados.

14. Human Language

Aquí entra la IA.

Usuario

corta la cebolla finita

↓

LLM

↓

Intent

↓

SLICE

target onion

thickness thin

↓

Motor determinista.

15. Unknown Knowledge

Muy importante.

El mundo acepta

unknown ingredient

unknown action

unknown state

sin romper nada.

16. AI Integration

La IA nunca cocina.

La IA interpreta.

Nunca decide reglas.

17. Robotics

Misma API.

Humano

↓

Timeline

↓

Robot

No cambia nada.

18. Multiplayer

Aunque ahora el proyecto sea single-player, la arquitectura debe explicar cómo varios agentes podrían operar sobre el mismo timeline sin cambiar el modelo fundamental.

19. Future

Olores.

Partículas.

Fermentación.

Tiempo.

Bacterias.

Economía.

Mercado.

Restaurantes.

Robots.

20. Appendix

Modelo JSON.

Ejemplos.

DSL.

Cooklang.

Comparación.

Referencias.

Y añadiría algo que casi ningún proyecto tiene

Después del documento conceptual, un segundo documento llamado:

ENGINE_INVARIANTS.md

Este documento no explica el sistema.

Explica lo que nunca puede romperse.

Ejemplo:

Recipes never contain executable knowledge.

Actions never know recipes.

Ingredients never know tools.

Tools never know recipes.

Instances are disposable.

Knowledge is immutable.

Timeline is append-only.

Every world state must be reconstructable from events.

Everything must remain deterministic.

LLMs are never authoritative.

Ese archivo vale oro para una Coding AI. Cada vez que genere código, puede comprobar si viola alguno de esos invariantes. Si lo hace, el cambio es incorrecto aunque compile.

Creo que estos dos documentos (CONCEPT.md y ENGINE_INVARIANTS.md) serían la base más sólida posible para Tortilla World. A partir de ellos, una IA de programación podría generar la arquitectura, detectar inconsistencias y mantener el proyecto alineado con la filosofía "Grandma First, Machine Deep" sin necesidad de reinventar el modelo en cada sesión.
````

## File: WORLD_MODEL.md
````markdown
# WORLD_MODEL.md — resolving CONCEPT.md's flagged fork

`CONCEPT.md`'s own opening line has said this since the file was written: "has
**not** been reconciled with `CLAUDE_DEV_CTX.md` ... which build around a linear
step-sequence recipe model that this outline explicitly argues against (see §12)
... Treat the two as parallel design tracks until that's resolved." Every piece of
engine work this whole session (`Action`, `Entity`, `RecipeScript`, `engine.ts`)
was built on the linear-sequence side of that fork. This document is the
resolution, prompted directly by being asked to think about recipe format and
domain-knowledge rules from a robot's actual point of view — which turns out to
answer the fork question too: **the world (objects undergoing continuous physical
and chemical transformation) is the primary representation; a recipe is one layer
of intent on top of it, not the core.**

## The good news: this doesn't throw away the session's work

`ActionSchema` (`action.ts`) is, structurally, already a classical AI-planning
operator — preconditions and effects, the STRIPS/PDDL shape — without ever having
been driven that way:

- **Preconditions**: `requiredTargetCapability`, `requiredTools`,
  `requiredIngredientCapabilities`, `requiredSecondaryCapability`,
  `statePrerequisites` (on the entity).
- **Effects**: `outputs.transformedState`/`transformedStateFromParameter`,
  `addsTag`, `spawnsTargetByproducts`, `destroysTarget`, `combinesInto`.

Every `RecipeScript.sequence` authored this session (`salted-fried-potatoes.json`,
both alioli variants, `garlic-oil-potatoes.json`, `tortilla-de-patatas.json`) is a
**hand-computed plan** — me doing backward-chaining from a goal ("a finished
tortilla") through this precondition/effect graph, by hand, one JSON file at a
time. That's exactly the job a planner automates. Nothing about `Entity`/`Action`/
`engine.ts`'s `applyAction` needs to be rebuilt for this — they become the
**domain model a planner searches over**, and a completed run's `log`
(`recipe-runner.ts` already produces one) becomes the **grounded trace/timeline**
CONCEPT.md §11 describes (undo/redo, playback, "ghost cooking," robot replay — all
"come for free from the event log," per that section, once there IS a log of a
real planned-and-executed run rather than a hand-authored script).

## What changes

### 1. Recipes become goal specifications, not scripts

`RecipeScriptSchema` (`recipe.ts`) — `initialInventory` + a fixed, ordered
`sequence` — is CONCEPT.md §12's rejected shape:

```
Step 1
Step 2
Step 3
```

What §12 actually asks for — Goals, Constraints, Required Ingredients, Acceptable
States, Serving, Optional Variants, Tolerance, Victory Conditions — is a
**declarative end-state predicate**, e.g. (sketch, not a committed schema):

```
goal: { entityId: "tortilla_mixture", state: "fried", tags: ["flipped"] }
constraints: [ "never exceed any non-advisory CCP", "onion-free" ]
requiredCapabilitiesAvailable: ["isCombinableBase", "isCombinableAddition", ...]
tolerance: { durationSeconds: { target: 900, acceptable: [700, 1100] } }
```

`RecipeScript` doesn't disappear — it becomes the **output** of planning against a
goal like this, not the input a person writes by hand. Today's `data/recipes/*.json`
files are best read, going forward, as **worked example plans** a planner should
be able to reproduce (or improve on) given the same goal and the same domain model,
not as the canonical authoring format.

### 2. Closed-loop execution, not "continue past the first failure"

`recipe-runner.ts`'s current behavior — a step's failure is logged and the run
*continues to the next step regardless* — is explicitly correct for what it was
built for: offline validation, "collect every problem, then report." **It would be
actively dangerous if reused verbatim to drive a real robot.** If `PEEL` fails, a
robot blindly proceeding to `CUT` is now cutting something that may not be
peeled, or may not be where the plan assumed — a physical hazard, not a logged
error. A robot execution mode needs to, at minimum, halt and replan (or trigger an
explicit recovery routine) on a step failure, not fall through to the next
pre-baked step. This is a real, load-bearing distinction between "validate a
recipe file" and "drive a robot," and the current single execution path
conflates them.

### 3. Discrete `state` is a derived classification of continuous reality, not the primitive

`Instance.state` (`"raw"`, `"fried"`, ...) is a label. A real robot's actual
sensed reality is continuous: surface temperature over time, moisture loss,
degree of protein denaturation, browning (Maillard reaction progression). The CCP
mechanism already does exactly this kind of thing in miniature — `heldSeconds` at
`heldC` is a *threshold classification* over an underlying continuous
time-temperature process, expressed as structured, checkable data. **The honest,
correctly-scoped generalization is NOT "simulate the continuous physics" — that
was explicitly, correctly rejected before** (the fabricated original `CLAUDE.md`
this project's real one replaced invented a nonexistent "finite-difference heat
simulation," and `ENGINE_INVARIANTS.md` #11 already draws this line for the
autonomous-execution case). The right scope: OCR's job is to define **what the
discrete label means** — the sensor-checkable predicate over continuous variables
that constitutes "fried" — as structured, queryable data (a `VerificationCriterion`
per state transition, generalizing the CCP pattern), and leave *measuring* those
continuous variables to a real sensing/control layer this repo doesn't and
shouldn't contain.

### 4. Domain knowledge as queryable data, not prose for a human reviewer

Look at what's actually in this repo's `metadata.notes` fields today: egg white/
yolk coagulation ranges (`egg_cooking.json`), why poaching water shouldn't fully
boil (`poach.json`), why garlic burns bitter past a threshold (`infuse.json`), why
an emulsion breaks when oil is added too fast (`emulsify.json`) — genuinely
correct, well-sourced domain knowledge. **All of it is prose, written for a human
code reviewer, not data a robot's own planner/verifier could query at runtime.**
If a robot needed "what's the safe temperature range for keeping egg yolk raw" at
decision time, the only place that lives right now is an English paragraph — and
having anything *interpret that paragraph* at runtime (an LLM, most obviously)
to extract a safety-critical number is exactly the failure mode
`ENGINE_INVARIANTS.md` #10 and CONCEPT.md §16 already forbid ("LLMs are never
authoritative... never decide validation rules"). The fix is structural: a
`DomainFact`/`PhysicalProperty` schema — typed value, unit, confidence/source,
`verified: boolean` — sitting *alongside* the prose (which stays, for humans),
not replacing it. `egg_cooking.json`'s buried `metadata.coagulationReferenceC`
object is the right instinct, already present, just not yet a first-class,
consistently-used pattern across the rest of this repo's domain knowledge.

## What I'm explicitly NOT proposing

- **Not** a continuous physics/heat-transfer simulator. Correctly out of scope,
  same reasoning as `ENGINE_INVARIANTS.md` #11 and the rejection of the
  fabricated earlier `CLAUDE.md`'s invented physics-engine framing.
- **Not** an immediate rewrite of `RecipeScriptSchema`/`recipe-runner.ts`/every
  existing `data/recipes/*.json` file. They're correct and useful as-is for what
  they currently do (validated, runnable, hand-authored plans) — this document
  proposes a NEW layer (goal specs + a planner) sitting on top / upstream of them,
  not a replacement built under time pressure inside an already-large session.
- **Not** a claim that a planner is a small addition. Real automated planning
  (search over a precondition/effect graph, handling partial observability,
  replanning on failure) is substantial, separate work — bigger than everything
  built this session combined. Flagged as a real future phase, not undersold.

## Status

Proposal / direction, not implemented. `CONCEPT.md`'s top-of-file fork note and
§12 are updated to point here as the resolution — the fork itself (goal-based vs.
linear-sequence) is resolved in favor of the goal-based/event-sourced track being
primary, with the linear-sequence machinery already built kept as the planner's
target representation and a completed run's trace format, not discarded.
````

## File: data/actions/bake.json
````json
{
  "id": "bake",
  "verb": "BAKE",
  "names": {
    "en": "Bake",
    "es": "Hornear"
  },
  "requiredTools": ["oven"],
  "requiredTargetCapability": "isBakeable",
  "validTargetKinds": ["ingredient"],
  "requiredIngredientCapabilities": [],
  "parameters": [],
  "outputs": {
    "transformedState": "baked",
    "spawnsTargetByproducts": false
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "Dry heat: unlike FRY/BOIL, no medium ingredient is required at all — requiredIngredientCapabilities is deliberately empty, not just satisfied by something ambient.",
    "retrySafeNote": "retrySafe: true (data-level, no duplication) — but re-baking an already-done target risks drying it out/overcooking, same culinary caveat as fry.json/boil.json's cooking actions."
  },
  "verification": {
    "method": "thermal",
    "description": "Internal temperature has risen to the expected range for the target's baked state (weakest verification in this vocabulary — oven air temperature is not the target's actual internal temperature, and no probe is assumed present)",
    "confidence": "low"
  },
  "hazards": [
    { "type": "hot_surface", "severity": "high", "note": "Oven cavity and bakeware — sustained high-temperature contact burn risk, worse than a stovetop pan (larger hot surface, less visibility of what's inside)" }
  ],
  "retrySafe": true
}
````

## File: data/actions/beat.json
````json
{
  "id": "beat",
  "verb": "BEAT",
  "names": {
    "en": "Beat",
    "es": "Batir"
  },
  "requiredTools": ["bowl"],
  "requiredTargetCapability": "isBeatable",
  "validTargetKinds": ["ingredient"],
  "requiredIngredientCapabilities": [],
  "parameters": [
    {
      "id": "intensity",
      "names": {
        "en": "Intensity",
        "es": "Intensidad"
      },
      "required": true,
      "allowedValues": ["lightly_beaten", "beaten", "well_beaten"]
    }
  ],
  "outputs": {
    "transformedStateFromParameter": "intensity",
    "spawnsTargetByproducts": false
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "CUT-shaped (data/actions/cut.json): one verb with an 'intensity' parameter rather than three separate verbs, since 'how much' is the only thing that varies. Answers 'mix the eggs more or less, or not at all' before an omelette/scrambled eggs — 'or not at all' is simply skipping this action; FRY/SCRAMBLE don't require a prior BEAT (see egg_cracked.json's possibleStates, still reachable directly from 'raw'). Optional like SALT: nothing downstream requires this action to have run.",
    "retrySafeNote": "retrySafe: true — re-beating further is physically continuous (lightly_beaten -> beaten -> well_beaten is a spectrum, transformedStateFromParameter just re-asserts whichever intensity is requested), not a discrete duplication risk."
  },
  "verification": {
    "method": "visual",
    "description": "Mixture uniformly yellow with no visible separate streaks of yolk/white remaining, texture matching the requested intensity",
    "confidence": "low"
  },
  "hazards": [],
  "retrySafe": true
}
````

## File: data/actions/combine.json
````json
{
  "id": "combine",
  "verb": "COMBINE",
  "names": {
    "en": "Combine",
    "es": "Combinar"
  },
  "requiredTools": [
    "bowl"
  ],
  "requiredTargetCapability": "isCombinableBase",
  "validTargetKinds": [
    "ingredient"
  ],
  "requiredIngredientCapabilities": [],
  "requiredSecondaryCapability": "isCombinableAddition",
  "parameters": [],
  "outputs": {
    "combinesInto": "tortilla_mixture",
    "spawnsTargetByproducts": false
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "The first COMBINE-shaped action in this repo — engine.ts's requiredSecondaryCapability/secondaryInstance and ActionOutputsSchema.combinesInto (action.ts) were built specifically to make this possible, after ROADMAP.md's tortilla capability test proved no verb could merge two separate instances into one (see LEARNINGS.md 2026-08-12). Target (isCombinableBase, e.g. fried potato — already in the bowl/pan) + secondary (isCombinableAddition, e.g. beaten salted egg — poured over it) are BOTH consumed; one new tortilla_mixture instance is spawned in their place, same conservation-of-mass shape destroysTarget already uses, just for two instances at once.",
    "scopeNote": "requiredTargetCapability/requiredSecondaryCapability/combinesInto are all FIXED on this one action definition — this is one specific, named combination (potato + egg -> tortilla_mixture), not a generic 'merge any two isCombinable things' verb. That's a deliberate scope decision, not an oversight: making the result entity a runtime parameter (rather than fixed per action) would need a real pair -> result lookup system, a bigger design decision ROADMAP.md explicitly left open rather than resolving speculatively here. A future second use case (e.g. combining bread + filling for a sandwich) would define its own action the same way SCRAMBLE/POACH/EMULSIFY/INFUSE were each their own verb rather than parameterizing FRY further.",
    "toolNote": "requiredTools: ['bowl'] — pour the beaten egg over the fried potato in a bowl before returning the mixture to the pan, matching real technique and reusing the same tool BEAT already established rather than inventing a new one.",
    "retrySafeNote": "retrySafe: true — but not because it's silently idempotent: destroysTarget means the target instance is already gone from inventory after a first success, so a blind retry fails loudly ('Unknown target instance') instead of duplicating anything."
  },
  "verification": {
    "method": "visual",
    "description": "A single homogeneous mixture present where two separate ingredients were a moment ago",
    "confidence": "medium"
  },
  "hazards": [
    {
      "type": "impact_force",
      "severity": "low",
      "note": "Bowl/mortar handling, minimal"
    }
  ],
  "retrySafe": true
}
````

## File: data/actions/crack.json
````json
{
  "id": "crack",
  "verb": "CRACK",
  "names": {
    "en": "Crack",
    "es": "Cascar"
  },
  "requiredTools": [],
  "requiredTargetCapability": "isCrackable",
  "validTargetKinds": [
    "ingredient"
  ],
  "requiredIngredientCapabilities": [],
  "parameters": [],
  "outputs": {
    "transformedState": "cracked",
    "spawnsTargetByproducts": true,
    "destroysTarget": true
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "Opens the egg without separating yolk from white — the entry point for scrambled eggs and the plain/French omelette, as opposed to SEPARATE (data/actions/separate.json) which explicitly splits yolk and white apart for recipes that need them independently (meringue, custard, ...). Same destroysTarget + spawnsTargetByproducts mechanism as SEPARATE; see egg.json's byproductsByAction.crack (spawns egg_shell + egg_cracked, not egg_yolk/egg_white).",
    "retrySafeNote": "retrySafe: true — but not because it's silently idempotent: destroysTarget means the target instance is already gone from inventory after a first success, so a blind retry fails loudly ('Unknown target instance') instead of duplicating anything."
  },
  "verification": {
    "method": "visual",
    "description": "Shell fully separated from contents; yolk/white or combined mixture visible in the target vessel",
    "confidence": "high"
  },
  "hazards": [
    {
      "type": "sharp_fragment",
      "severity": "low",
      "note": "Eggshell fragments"
    }
  ],
  "retrySafe": true
}
````

## File: data/actions/flip.json
````json
{
  "id": "flip",
  "verb": "FLIP",
  "names": {
    "en": "Flip",
    "es": "Voltear"
  },
  "requiredTools": [
    "pan"
  ],
  "requiredTargetCapability": "isFlippable",
  "validTargetKinds": [
    "ingredient"
  ],
  "requiredIngredientCapabilities": [],
  "parameters": [],
  "outputs": {
    "addsTag": "flipped",
    "spawnsTargetByproducts": false
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "addsTag 'flipped', not transformedState — mirrors SALT's precedent (data/actions/salt.json): flipping doesn't change WHAT state the target is cooking in (still 'fried'), it's an orthogonal fact layered on top, and nothing here forces flip-then-fry-again ordering (that's a fact about the recipe sequence, not this action). Added directly in response to ROADMAP.md's tortilla capability test — this exact gap ('the single most technique-defining, failure-prone step in the dish' had no verb at all) was the second of the two named blockers.",
    "toolAndTechniqueGap": "requiredTools is 'pan' only — deliberately not narrower. Real technique varies by dish: a fried egg flips with a spatula, a whole tortilla is inverted onto a plate and slid back in — mechanically different motions achieving the same 'now cook the other side' outcome. Neither a 'spatula' nor a 'plate' tool entity exists in data/entities/, and gating FLIP on one specific tool would wrongly block the other dish's version of this same action. Left as a known, stated gap rather than arbitrarily picking one technique to require.",
    "retrySafeNote": "retrySafe: true — engine.ts guards addsTag against duplicates ('!instance.tags.includes(...)'), so re-running this after an interruption is a silent no-op, not a double effect."
  },
  "verification": {
    "method": "visual",
    "description": "The previously-down side now faces up, visibly different in color/texture from the currently-down side",
    "confidence": "high"
  },
  "hazards": [
    {
      "type": "hot_oil",
      "severity": "medium",
      "note": "Splatter risk during the flip motion"
    }
  ],
  "retrySafe": true
}
````

## File: data/actions/fold.json
````json
{
  "id": "fold",
  "verb": "FOLD",
  "names": {
    "en": "Fold",
    "es": "Doblar"
  },
  "requiredTools": [
    "pan"
  ],
  "requiredTargetCapability": "isFoldable",
  "validTargetKinds": [
    "ingredient"
  ],
  "requiredIngredientCapabilities": [],
  "parameters": [],
  "outputs": {
    "addsTag": "folded",
    "spawnsTargetByproducts": false
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "addsTag 'folded', mirroring FLIP's addsTag: 'flipped' and SALT's precedent — the classical French omelette's defining shape step (rolled/folded into an oval with a spatula, off or just at the end of heat), distinct from FRY itself. Not the Spanish tortilla francesa's usual presentation (typically served flat, unfolded) — see fry.json's internalTextureNote for that disambiguation. requiredTools 'pan' only, same as FLIP's toolAndTechniqueGap reasoning: doesn't gate on a specific utensil (spatula) since none is modeled as a distinct tool entity.",
    "retrySafeNote": "retrySafe: true — engine.ts guards addsTag against duplicates ('!instance.tags.includes(...)'), so re-running this after an interruption is a silent no-op, not a double effect."
  },
  "verification": {
    "method": "visual",
    "description": "Target rolled/folded into the expected oval shape rather than lying flat",
    "confidence": "high"
  },
  "hazards": [
    {
      "type": "hot_surface",
      "severity": "low",
      "note": "Still in or near the hot pan"
    }
  ],
  "retrySafe": true
}
````

## File: data/actions/infuse.json
````json
{
  "id": "infuse",
  "verb": "INFUSE",
  "names": {
    "en": "Infuse",
    "es": "Aromatizar"
  },
  "requiredTools": [
    "pan"
  ],
  "requiredTargetCapability": "isInfusable",
  "validTargetKinds": [
    "ingredient"
  ],
  "requiredIngredientCapabilities": [
    "isAromaticSource"
  ],
  "parameters": [
    {
      "id": "heatLevel",
      "names": {
        "en": "Heat level",
        "es": "Nivel de fuego"
      },
      "required": false,
      "allowedValues": [
        "low",
        "medium",
        "high"
      ]
    },
    {
      "id": "durationSeconds",
      "names": {
        "en": "Duration",
        "es": "Duración"
      },
      "required": false,
      "numericRange": {
        "unit": "seconds",
        "min": 30,
        "max": 1200
      }
    }
  ],
  "outputs": {
    "addsTag": "garlic_infused",
    "spawnsTargetByproducts": false
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "Targets the OIL, not the garlic sitting in it — 'the oil becomes garlic-flavored' is a property the oil gains, orthogonal to whatever state it's already in (cold/hot), so this uses addsTag exactly like SALT (data/actions/salt.json) rather than transformedState. The garlic itself doesn't change here; it's the requiredIngredientCapabilities-satisfying ingredient (isAromaticSource, garlic.json), not the target.",
    "flavorScienceNote": "heatLevel matters more here than for most actions: garlic's flavor compounds (allicin and its breakdown products, diallyl sulfides) extract into the oil readily at gentle heat, but past a fairly low scorch point garlic's sugars and amino acids brown/pyrolyze (a Maillard-adjacent reaction) into bitter, acrid compounds that ruin the batch — 'low and slow' is standard advice for a reason, unlike a typical FRY where higher heat is often desirable. Not enforced as a state branch, for the same honesty reasons as emulsify.json's patienceNote: this engine has no conditional-outcome mechanism, so heatLevel/durationSeconds stay informational rather than a disguised state-picker.",
    "knownModelingGap": "requiredIngredientCapabilities only checks a flag on the ingredient's ENTITY definition (garlic.json), not the current STATE of the specific garlic instance present — so a whole raw clove and a knife-minced garlic both satisfy isAromaticSource identically here, even though real technique strongly prefers cut garlic (more exposed surface, per garlic.json's flavorChemistryNote on rupture-triggered allicin formation) for actually flavoring oil well. This engine doesn't check ingredient instance state at all, only presence — a pre-existing limitation (see engine.ts's doc comment), not something new to this action.",
    "safetyNote": "Garlic-in-oil is a real, FDA-documented botulism risk (Clostridium botulinum spores, naturally present on garlic grown in soil, germinate and can produce toxin in oil's anaerobic, low-acid environment if left at unsafe temperatures) — but it is deliberately NOT modeled as a CriticalControlPointSchema entry (thermal.ts, see data/ccps/egg_cooking.json for the pattern). That schema models a cook-time temperature/hold-time threshold for pathogen destruction DURING a thermal step; the garlic-oil hazard is the opposite shape of problem — it's a POST-preparation STORAGE-duration/temperature risk (commercial garlic-in-oil requires refrigeration and a short shelf life, or acidification to pH <=4.6, specifically because of this), not something INFUSE's own heat kills or that any parameter of this action controls. Forcing it into the CCP schema would misrepresent the hazard's actual mechanism. This engine has no concept of elapsed time or storage conditions after a recipe finishes, so this risk is simply outside what it can currently represent — flagged here rather than silently ignored or dishonestly shoehorned in.",
    "retrySafeNote": "retrySafe: true — engine.ts guards addsTag against duplicates ('!instance.tags.includes(...)'), so re-running this after an interruption is a silent no-op, not a double effect. Culinary caveat still applies past the point of fragrant: continuing past that point risks scorching (see this action's own flavorScienceNote)."
  },
  "verification": {
    "method": "olfactory",
    "description": "Oil visibly tinted and aromatic; garlic pieces golden, not browned/scorched",
    "confidence": "medium"
  },
  "hazards": [
    {
      "type": "hot_oil",
      "severity": "medium",
      "note": "Oil actively heated with aromatics present — splatter and scorch risk"
    }
  ],
  "retrySafe": true
}
````

## File: data/actions/mix.json
````json
{
  "id": "mix",
  "verb": "MIX",
  "names": {
    "en": "Mix",
    "es": "Mezclar"
  },
  "requiredTools": [
    "mixer"
  ],
  "requiredTargetCapability": "isBlendable",
  "validTargetKinds": [
    "ingredient"
  ],
  "parameters": [],
  "outputs": {
    "transformedState": "blended",
    "spawnsTargetByproducts": false
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "One of CONCEPT.md §10's Event System verbs (PICK_UP, DROP, CUT, MOVE, HEAT, WAIT, MIX). potato_peel.json is the first entity to declare isBlendable — a second reuse path alongside FRY (data/actions/fry.json): peels can be fried into crisps or put in a mixer instead of being discarded.",
    "retrySafeNote": "retrySafe: true — further mixing an already-blended target is physically continuous, not a discrete duplication risk."
  },
  "verification": {
    "method": "visual",
    "description": "Texture uniformly blended, no distinct unblended chunks remaining",
    "confidence": "medium"
  },
  "hazards": [
    {
      "type": "moving_blade",
      "severity": "medium",
      "note": "Electric mixer/blender — motorized blade risk, distinct from a static knife's"
    }
  ],
  "retrySafe": true
}
````

## File: data/actions/peel.json
````json
{
  "id": "peel",
  "verb": "PEEL",
  "names": {
    "en": "Peel",
    "es": "Pelar"
  },
  "requiredTools": [
    "knife"
  ],
  "requiredTargetCapability": "isPeelable",
  "validTargetKinds": [
    "ingredient"
  ],
  "outputs": {
    "transformedState": "peeled",
    "spawnsTargetByproducts": true
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "The worked example from CONCEPT.md §5 ('World Layer understands PEEL, requires: knife, creates: peeled potato, potato peel') and CLAUDE_DEV_CTX.md ('you cannot peel a potato that is already boiled'). Byproducts are read from the target entity's producedByproducts, not hardcoded here — see ActionOutputsSchema.",
    "retrySafeNote": "retrySafe: FALSE — a real, concrete finding, not a cautious default. PEEL neither destroysTarget nor has a statePrerequisite blocking re-running it on an already-peeled target: a blind retry after an interruption would spawn a SECOND potato_peel/egg_shell byproduct instance that doesn't physically exist — you cannot peel a potato twice and get two peels. A robot's fault-recovery layer must check current state before retrying PEEL specifically, not just re-issue the last step."
  },
  "verification": {
    "method": "visual",
    "description": "Skin/shell/peel fully absent from the target's surface",
    "confidence": "high"
  },
  "hazards": [
    {
      "type": "sharp_blade",
      "severity": "medium",
      "note": "Requires a knife — blade-to-hand contact risk"
    }
  ],
  "retrySafe": false
}
````

## File: data/actions/separate.json
````json
{
  "id": "separate",
  "verb": "SEPARATE",
  "names": {
    "en": "Separate",
    "es": "Separar"
  },
  "requiredTools": [],
  "requiredTargetCapability": "isSeparable",
  "validTargetKinds": [
    "ingredient"
  ],
  "requiredIngredientCapabilities": [],
  "parameters": [],
  "outputs": {
    "transformedState": "separated",
    "spawnsTargetByproducts": true,
    "destroysTarget": true
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "CLAUDE_DEV_CTX.md's own conservation-of-mass example: 'separate' destroys the parent egg, spawns disjoint egg_shell + egg_yolk + egg_white in its place (data/entities/egg.json's byproductsByAction.separate). requiredTargetCapability 'isSeparable' isn't one of CapabilitiesSchema's named fields (ingredient.ts) — it validates anyway via that schema's deliberate .catchall(z.boolean()), same pattern as any future unrecognized capability. destroysTarget: true is what actually makes recipe-runner.ts remove the egg instance from inventory instead of keeping it as a 'separated' egg alongside its own byproducts — see engine.ts's ExecutionResult.destroyed and ROADMAP.md's previously-unchecked 'Conservation of mass/entities on applyStep' item, now implemented for this explicit-opt-in case (not yet a general inventory-quantity system).",
    "retrySafeNote": "retrySafe: true — but not because it's silently idempotent: destroysTarget means the target instance is already gone from inventory after a first success, so a blind retry fails loudly ('Unknown target instance') instead of duplicating anything."
  },
  "verification": {
    "method": "visual",
    "description": "Yolk and white present as two distinct, unmixed portions, shell fully removed",
    "confidence": "high"
  },
  "hazards": [
    {
      "type": "sharp_fragment",
      "severity": "low",
      "note": "Eggshell fragments"
    }
  ],
  "retrySafe": true
}
````

## File: data/actions/shock.json
````json
{
  "id": "shock",
  "verb": "SHOCK",
  "names": {
    "en": "Shock (ice bath)",
    "es": "Choque Térmico"
  },
  "requiredTools": [
    "bowl"
  ],
  "requiredTargetCapability": "isShockable",
  "validTargetKinds": [
    "ingredient"
  ],
  "requiredIngredientCapabilities": [],
  "parameters": [],
  "outputs": {
    "addsTag": "shocked",
    "spawnsTargetByproducts": false
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "addsTag 'shocked', not a state change — 'boiled' is still an accurate description of the egg, this is an orthogonal fact layered on top, same pattern as SALT/FLIP/FOLD. Plunging the just-boiled egg into ice water immediately after removing it from the pot.",
    "carryoverCookingNote": "The actual reason this action needs to exist, not just a peeling convenience: BOIL's `durationSeconds` alone does NOT fully determine a boiled egg's final doneness. While boiling, the egg's outer layers are hotter than its center — heat has only had time to diffuse partway in. The moment the egg leaves the pot, that stored heat keeps diffusing inward (\"carryover\"/\"residual\" cooking, the same phenomenon that makes a roast keep rising in temperature after it leaves the oven) — a yolk can continue firming for a couple of minutes with zero external heat applied. SHOCK stops this by rapidly pulling heat back out. Skip it, and the same `durationSeconds` that gave a jammy yolk on one occasion can give a firmer one on another, depending entirely on how long the egg sat in residual heat afterward — a variable this schema does not, and should not try to, simulate (see WORLD_MODEL.md: `Instance.state` is meant to be a derived classification of an underlying continuous physical process, not the process itself — this is that abstract point made concrete: BOIL treating 'reached durationSeconds' as an instantaneous, complete transition was always a simplification, and SHOCK is the one lever this model gives you to actually make that simplification true in practice, by arresting the continuous process at a known point rather than pretending it wasn't happening).",
    "peelingNote": "Real, secondary benefit, not the main reason this exists: rapid contraction from the temperature drop shrinks the white slightly away from the shell membrane, which is why a shocked hard-boiled egg is noticeably easier to peel than one left to cool slowly. Not enforced here — peel.json's requirements are unchanged, this is real technique advice recorded as domain knowledge, not a hard gate (same honesty limit as everywhere else 'informational only' has been used this session).",
    "retrySafeNote": "retrySafe: true — engine.ts guards addsTag against duplicates ('!instance.tags.includes(...)'), so re-running this after an interruption is a silent no-op, not a double effect. Extending ice-bath time has no real downside either — same unambiguous-retry-safety category as pasteurize.json."
  },
  "verification": {
    "method": "thermal",
    "description": "Target's surface has cooled rapidly — cool to the touch within roughly a minute of ice-water contact",
    "confidence": "medium"
  },
  "hazards": [
    {
      "type": "cold_shock",
      "severity": "low",
      "note": "Ice water — minor cold-discomfort risk to bare skin, not a real hazard when using tools"
    }
  ],
  "retrySafe": true
}
````

## File: data/actions/wash.json
````json
{
  "id": "wash",
  "verb": "WASH",
  "names": {
    "en": "Wash",
    "es": "Lavar"
  },
  "requiredTools": [],
  "requiredTargetCapability": "isWashable",
  "validTargetKinds": [
    "ingredient"
  ],
  "outputs": {
    "transformedState": "washed",
    "spawnsTargetByproducts": false
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "No requiredTools: running water is treated as ambient rather than a tool entity for now. validTargetKinds is ingredient-only even though knife.json also asserts isWashable — a tool's 'clean' state doesn't map onto the same transformedState ('washed') as an ingredient's, so wiring WASH up to tools is left for later rather than forced to fit here.",
    "retrySafeNote": "retrySafe: true — re-washing something already clean is harmless."
  },
  "verification": {
    "method": "visual",
    "description": "No visible dirt/residue remaining on the surface",
    "confidence": "medium"
  },
  "hazards": [],
  "retrySafe": true
}
````

## File: data/heat-sources/gas.json
````json
{
  "id": "gas",
  "names": {
    "en": "Gas burner",
    "es": "Fuego de gas"
  },
  "typicalPowerWattsRange": { "min": 1800, "max": 3500 },
  "thermalEfficiencyPercentRange": { "min": 32, "max": 40 },
  "responseSpeed": "instant",
  "controlPrecision": "moderate",
  "manualPositioningRelevance": "moderate",
  "citation": {
    "source": "Commonly cited consumer cooktop comparisons (e.g. U.S. Department of Energy consumer cooktop-efficiency guidance; home-burner output figures commonly given in BTU/hr, ~6,000-12,000 BTU/hr converted here to watts)",
    "confidence": "commonly_cited_unverified",
    "note": "Representative home-kitchen range, not a specific model's spec sheet — no single primary source looked up this session. Gas cooktops are consistently cited as the LEAST efficient common home heat source (most heat escapes around the pan's sides as visible flame) despite feeling 'powerful' because the response is instant and visible — power output and delivered-heat efficiency are genuinely different numbers, easy to conflate."
  },
  "note": "Flame size visibly and immediately tracks the control knob — the most direct, immediate feedback loop of the three, which is why 'instant' response coexists with only 'moderate' control precision here: adjustability isn't the same as precision. Holding a genuinely gentle, even simmer on gas still takes attention (uneven flame ring, easy to overshoot a very low setting) — a real, commonly-experienced limitation, not a contradiction of 'instant'. manualPositioningRelevance: 'moderate' — the knob is usually enough, but skilled cooks do lift/tilt a pan off a gas flame momentarily for fine control the dial alone can't give (e.g. rescuing a sauce that's about to boil over), a real technique even though it's not load-bearing the way it is on wood fire.",
  "metadata": {}
}
````

## File: data/heat-sources/vitro.json
````json
{
  "id": "vitro",
  "names": {
    "en": "Ceramic-glass radiant electric hob (\"vitro\")",
    "es": "Vitrocerámica"
  },
  "typicalPowerWattsRange": { "min": 1200, "max": 2100 },
  "thermalEfficiencyPercentRange": { "min": 65, "max": 74 },
  "responseSpeed": "slow",
  "controlPrecision": "moderate",
  "manualPositioningRelevance": "low",
  "citation": {
    "source": "Commonly cited consumer cooktop comparisons (e.g. U.S. Department of Energy consumer cooktop-efficiency guidance; typical single-zone radiant electric hob wattage from consumer appliance spec sheets)",
    "confidence": "commonly_cited_unverified",
    "note": "Representative range, not a specific model's spec sheet — no single primary source looked up this session."
  },
  "note": "IMPORTANT, commonly confused distinction: 'vitro'/vitrocerámica is a RADIANT electric hob — a resistive coil heats the ceramic glass, which then conducts heat into the pan. It is NOT induction, despite both having a flat glass-look surface and often being confused as the same thing: induction heats the pan directly via a magnetic field (much faster response, works only with ferromagnetic cookware, not modeled as a separate entity here since it wasn't asked about). Vitro's 'slow' response is real, physical thermal lag: the glass and coil have real thermal mass, so turning the dial down does NOT reduce delivered heat immediately the way closing a gas valve does — the surface stays hot and keeps transferring heat for a real, noticeable period after being turned down. This is the single most commonly-experienced practical difference from gas: overshooting a target temperature is easy on vitro precisely because the feedback loop a cook is used to (turn it down, heat drops now) doesn't hold the same way. manualPositioningRelevance: 'low' — a flat zoned glass surface gives nowhere meaningfully cooler to move a pan TO the way a fire's edge or a lifted pan over gas does; the dial (and waiting out its lag) is genuinely the only real control here.",
  "metadata": {}
}
````

## File: data/heat-sources/wood_fire.json
````json
{
  "id": "wood_fire",
  "names": {
    "en": "Open wood fire",
    "es": "Fuego de leña"
  },
  "typicalPowerWattsRange": { "min": 1000, "max": 9000 },
  "thermalEfficiencyPercentRange": { "min": 10, "max": 20 },
  "responseSpeed": "highly_variable",
  "controlPrecision": "coarse",
  "manualPositioningRelevance": "high",
  "citation": {
    "source": "Commonly cited figures for open-fire cooking efficiency (widely repeated in cooking-science and appliance-efficiency comparisons, e.g. Harold McGee-style discussions of traditional cooking methods; open-fire efficiency is consistently cited as far lower than any enclosed/modern cooktop)",
    "confidence": "commonly_cited_unverified",
    "note": "By far the widest, least-precise range of the three — genuinely inherent to the method, not a gap in this citation: wood species, dryness/seasoning, fire size, and airflow all change delivered heat by roughly an order of magnitude, and none of that is a 'setting' the way a gas valve or an electric dial is one."
  },
  "note": "The oldest of the three methods (how boiling was done for most of human history; still standard in many rural/traditional/off-grid contexts, not a novelty case) and, by every axis this schema tracks, the hardest to use precisely: power output isn't chosen so much as managed (adding/removing wood, adjusting airflow/damper), it drifts on its own between deliberate adjustments (a log settling, a gust of air), and most of the fire's heat escapes to the surroundings rather than reaching the pot — the low efficiency figure IS the reason a wood fire needs a much bigger flame than a gas burner to boil the same pot in comparable time. Holding a genuinely gentle simmer (as opposed to a rolling boil) is the single hardest technique on this heat source of the three — relevant directly to egg-boiling, where a violent rolling boil knocks eggs against the pot and against each other, raising crack risk (see egg.json's crackContainmentNote) well beyond what a controlled gas or vitro simmer would cause. Real operational hazards beyond food safety: open flame, smoke inhalation, burns from handling fuel — outside this schema's scope (HazardSchema lives on ActionSchema, not here) but worth stating plainly rather than pretending a heat-source comparison is safety-neutral. manualPositioningRelevance: 'high' — this is the real, central skill of open-fire cooking: since the fire itself usually can't be finely dialed, an experienced cook controls delivered heat mainly by WHERE the pan sits (over the flame's core, at its edge, on embers, suspended higher/lower) and by moving it deliberately, not by adjusting the fire moment-to-moment. Precisely the technique the user asked to have named honestly rather than folded into a single 'coarse control' rating that would understate how much real skill compensates for it.",
  "metadata": {}
}
````

## File: data/recipes/french-omelette.json
````json
{
  "id": "french_omelette",
  "names": {
    "en": "French Omelette (baveuse, folded)",
    "es": "Tortilla al Estilo Francés (jugosa, doblada)",
    "fr": "Omelette (baveuse, roulée)"
  },
  "initialInventory": [
    { "id": "egg-1", "entityId": "egg", "state": "raw", "tags": [] },
    { "id": "oil-1", "entityId": "oil", "state": "cold", "tags": [] },
    {
      "id": "salt-1",
      "entityId": "salt",
      "state": "dry",
      "tags": [],
      "quantity": {
        "kind": "imprecise",
        "descriptor": "pinch",
        "approxRangeGrams": { "min": 0.3, "max": 0.6 },
        "citation": {
          "source": "Commonly cited culinary conversion: 1 pinch \u2248 1/16 tsp of fine table salt",
          "confidence": "commonly_cited_unverified",
          "note": "Genuinely imprecise by convention, not just uncited \u2014 cooks don't measure a pinch. Also varies by crystal size (fine vs. coarse), which this repo doesn't model as a separate entity yet \u2014 see QuantitySchema's doc comment (ingredient.ts)."
        }
      }
    }
  ],
  "availableTools": ["pan", "bowl"],
  "sequence": [
    { "actionId": "crack", "targetInstanceId": "egg-1", "params": {}, "availableIngredientInstanceIds": [] },
    { "actionId": "beat", "targetInstanceId": "egg_cracked-2", "params": { "intensity": "well_beaten" }, "availableIngredientInstanceIds": [] },
    { "actionId": "salt", "targetInstanceId": "egg_cracked-2", "params": { "timing": "before_cooking" }, "availableIngredientInstanceIds": ["salt-1"] },
    {
      "actionId": "fry",
      "targetInstanceId": "egg_cracked-2",
      "params": { "heatLevel": "high", "durationSeconds": "45", "agitation": "constant_stir", "internalTexture": "baveuse" },
      "availableIngredientInstanceIds": ["oil-1"]
    },
    { "actionId": "fold", "targetInstanceId": "egg_cracked-2", "params": {}, "availableIngredientInstanceIds": [] }
  ],
  "metadata": {
    "notes": "Same opening three steps as tortilla-francesa.json (same entity, same CRACK/BEAT/SALT) — deliberately, to make the divergence point exact rather than starting from two different setups. Diverges at FRY: 'well_beaten' (not just 'beaten' — classical technique wants the mixture fully homogeneous), high heat + only 45s (not medium/180s) + constant_stir (not undisturbed — the French technique actively scrambles briefly with a fork/spatula before letting it set, producing small soft curds that then get rolled together, not a static sheet) + internalTexture: 'baveuse' (deliberately still soft/custardy, not cooked through). Then FOLD (data/actions/fold.json) — the step tortilla-francesa.json never takes — rolls it into the classical oval shape. tags end [salted, folded], distinct from tortilla-francesa.json's [salted] alone.",
    "haccpNote": "durationSeconds: 45 still clears egg_cooking.json's 15s heldSeconds — baveuse/soft is not the same axis as unsafe; a properly executed French omelette is a fully cooked dish (albeit briefly, at high heat) that happens to look custardy, not an undercooked one. Contrast with handmade-alioli-egg-yolk.json's raw, never-heated yolk, which needed PASTEURIZE precisely because no heat step existed at all."
  }
}
````

## File: data/recipes/garlic-oil-potatoes.json
````json
{
  "id": "garlic_oil_potatoes",
  "names": {
    "en": "Garlic Oil Potatoes",
    "es": "Patatas al Ajillo"
  },
  "initialInventory": [
    { "id": "garlic-1", "entityId": "garlic", "state": "raw", "tags": [] },
    { "id": "oil-1", "entityId": "oil", "state": "cold", "tags": [] },
    { "id": "potato-1", "entityId": "potato", "state": "raw", "tags": [] },
    {
      "id": "salt-1",
      "entityId": "salt",
      "state": "dry",
      "tags": [],
      "quantity": {
        "kind": "imprecise",
        "descriptor": "pinch",
        "approxRangeGrams": { "min": 0.3, "max": 0.6 },
        "citation": {
          "source": "Commonly cited culinary conversion: 1 pinch \u2248 1/16 tsp of fine table salt",
          "confidence": "commonly_cited_unverified",
          "note": "Genuinely imprecise by convention, not just uncited \u2014 cooks don't measure a pinch. Also varies by crystal size (fine vs. coarse), which this repo doesn't model as a separate entity yet \u2014 see QuantitySchema's doc comment (ingredient.ts)."
        }
      }
    }
  ],
  "availableTools": ["knife", "pan"],
  "sequence": [
    { "actionId": "peel", "targetInstanceId": "garlic-1", "params": {}, "availableIngredientInstanceIds": [] },
    { "actionId": "cut", "targetInstanceId": "garlic-1", "params": { "shape": "sliced" }, "availableIngredientInstanceIds": [] },
    {
      "actionId": "fry",
      "targetInstanceId": "garlic-1",
      "params": { "heatLevel": "medium", "durationSeconds": "400", "doneness": "brown" },
      "availableIngredientInstanceIds": ["oil-1"]
    },
    {
      "actionId": "infuse",
      "targetInstanceId": "oil-1",
      "params": { "heatLevel": "medium", "durationSeconds": "400" },
      "availableIngredientInstanceIds": ["garlic-1"]
    },
    { "actionId": "wash", "targetInstanceId": "potato-1", "params": {}, "availableIngredientInstanceIds": [] },
    { "actionId": "peel", "targetInstanceId": "potato-1", "params": {}, "availableIngredientInstanceIds": [] },
    { "actionId": "cut", "targetInstanceId": "potato-1", "params": { "shape": "diced" }, "availableIngredientInstanceIds": [] },
    { "actionId": "fry", "targetInstanceId": "potato-1", "params": { "heatLevel": "medium" }, "availableIngredientInstanceIds": ["oil-1"] },
    { "actionId": "salt", "targetInstanceId": "potato-1", "params": { "timing": "after_cooking" }, "availableIngredientInstanceIds": ["salt-1"] }
  ],
  "metadata": {
    "notes": "Two products from one pan of oil, in order: (1) garlic-1 sliced and fried until doneness:'brown' — see fry.json's donenessNote for why that's informational, not a distinct enforced state; still ends in state 'fried', same as any other fried garlic. (2) oil-1 then INFUSEd (garlic-1 as the available ingredient, not consumed — engine.ts only checks ingredient presence, never decrements it, so the same garlic-1 instance that just finished frying is exactly what satisfies INFUSE's isAromaticSource requirement) — oil-1 gains tag 'garlic_infused' without losing its own state. (3) The SAME oil-1 instance is then reused as potato-1's frying medium two steps later — proving 'the oil, now flavored, is used to cook something else' is already fully supported: nothing here consumes/removes oil-1 from availableIngredientInstanceIds' pool between steps.",
    "garlicReuseNote": "garlic-1 is never targeted again after frying — it just sits in the final inventory at state 'fried', unconsumed and available, exactly matching 'you can reuse the cooked garlic somehow (salad)'. What this recipe does NOT do is model actually assembling it into a salad: this engine has no mechanic for combining multiple finished instances into a new composite dish (EntitySchema.structure.composite/components exists but nothing populates or consumes it yet), and no salad-base entities (lettuce, tomato, ...) exist in data/entities/ yet either. Representing 'salad' honestly would need a real new ASSEMBLE-style action, not something this recipe should fake by, say, spawning a hollow 'salad' entity that's really just garlic wearing a different id. Left as a genuine open extension rather than built here."
  }
}
````

## File: data/recipes/huevo-frito.json
````json
{
  "id": "huevo_frito",
  "names": {
    "en": "Fried Egg (Spanish-style, runny yolk, puntilla)",
    "es": "Huevo Frito (yema líquida, con puntilla)"
  },
  "initialInventory": [
    { "id": "egg-1", "entityId": "egg", "state": "raw", "tags": [] },
    { "id": "oil-1", "entityId": "oil", "state": "cold", "tags": [] },
    {
      "id": "salt-1",
      "entityId": "salt",
      "state": "dry",
      "tags": [],
      "quantity": {
        "kind": "imprecise",
        "descriptor": "pinch",
        "approxRangeGrams": { "min": 0.3, "max": 0.6 },
        "citation": {
          "source": "Commonly cited culinary conversion: 1 pinch \u2248 1/16 tsp of fine table salt",
          "confidence": "commonly_cited_unverified",
          "note": "Genuinely imprecise by convention, not just uncited \u2014 cooks don't measure a pinch. Also varies by crystal size (fine vs. coarse), which this repo doesn't model as a separate entity yet \u2014 see QuantitySchema's doc comment (ingredient.ts)."
        }
      }
    }
  ],
  "availableTools": ["pan"],
  "sequence": [
    {
      "actionId": "fry",
      "targetInstanceId": "egg-1",
      "params": { "heatLevel": "high", "durationSeconds": "90", "yolkDoneness": "runny", "edgeStyle": "crispy_lace_puntilla" },
      "availableIngredientInstanceIds": ["oil-1"]
    },
    { "actionId": "salt", "targetInstanceId": "egg-1", "params": { "timing": "after_cooking" }, "availableIngredientInstanceIds": ["salt-1"] }
  ],
  "metadata": {
    "notes": "The classic Spanish tapas-bar huevo frito: generous hot oil basted over the egg (edgeStyle: 'crispy_lace_puntilla' — real technique, see fry.json's edgeStyleNote), yolk left runny (yolkDoneness: 'runny'), 90 seconds at high heat — fast, hot, short. Salted after, not before (unlike garlic in the alioli recipes) — salting a raw egg before frying draws out moisture and can toughen/thin it, the opposite of tortilla-de-patatas.json's potato-and-egg sequencing logic, which is exactly why each recipe's salt placement has been decided per-dish rather than copied.",
    "haccpNote": "yolkDoneness: 'runny' + durationSeconds: 90 (well above egg_cooking.json's 15s heldSeconds — this dish is FRIED, unlike the raw-yolk alioli case) still clears the CCP comfortably: fry.json's yolkDonenessNote's warning is about a customer-ordered runny yolk NEEDING a duration that's honest about being short, not about every runny-yolk fried egg being unsafe. 90s of active frying at high heat is not the same risk profile as raw, unpasteurized, never-heated yolk (handmade-alioli-egg-yolk.json) — this is the FDA's ordinary 'increased risk, disclosed' cooked-egg case (advisoryOnly: true), not the hard-reject raw case (egg_pasteurization_raw.json, advisoryOnly: false)."
  }
}
````

## File: data/recipes/ruhei.json
````json
{
  "id": "ruhei",
  "names": {
    "en": "Rührei (German-style scrambled eggs)",
    "de": "Rührei",
    "es": "Huevos revueltos al estilo alemán"
  },
  "initialInventory": [
    { "id": "egg-1", "entityId": "egg", "state": "raw", "tags": [] },
    { "id": "oil-1", "entityId": "oil", "state": "cold", "tags": [] },
    {
      "id": "salt-1",
      "entityId": "salt",
      "state": "dry",
      "tags": [],
      "quantity": {
        "kind": "imprecise",
        "descriptor": "pinch",
        "approxRangeGrams": { "min": 0.3, "max": 0.6 },
        "citation": {
          "source": "Commonly cited culinary conversion: 1 pinch \u2248 1/16 tsp of fine table salt",
          "confidence": "commonly_cited_unverified",
          "note": "Genuinely imprecise by convention, not just uncited \u2014 cooks don't measure a pinch. Also varies by crystal size (fine vs. coarse), which this repo doesn't model as a separate entity yet \u2014 see QuantitySchema's doc comment (ingredient.ts)."
        }
      }
    }
  ],
  "availableTools": ["pan", "bowl"],
  "sequence": [
    { "actionId": "crack", "targetInstanceId": "egg-1", "params": {}, "availableIngredientInstanceIds": [] },
    { "actionId": "beat", "targetInstanceId": "egg_cracked-2", "params": { "intensity": "beaten" }, "availableIngredientInstanceIds": [] },
    { "actionId": "salt", "targetInstanceId": "egg_cracked-2", "params": { "timing": "before_cooking" }, "availableIngredientInstanceIds": ["salt-1"] },
    {
      "actionId": "scramble",
      "targetInstanceId": "egg_cracked-2",
      "params": { "heatLevel": "low", "durationSeconds": "240", "curdSize": "small" },
      "availableIngredientInstanceIds": ["oil-1"]
    }
  ],
  "metadata": {
    "notes": "German-style Rührei: low heat, long-ish gentle cook, small/creamy curds — the opposite of a fast hot American-diner scramble, a real, deliberate technique choice (curdSize: 'small', heatLevel: 'low'). Uses ONLY actions that already existed before this recipe was written (CRACK, BEAT, SALT, SCRAMBLE) — no new action or entity needed, unlike tortilla_de_patatas.json (which needed COMBINE + FLIP) or handmade-alioli-egg-yolk.json (which needed PASTEURIZE). Written to answer a concrete question: 'a robot downloads this model to cook breakfast — how does it help?' — this file plus a clean `npm run recipe -- ruhei` run is the literal, checkable answer, not a description of one.",
    "haccpNote": "egg_cracked.json's criticalControlPointsByAction.scramble is already wired to egg_cooking.json (built several turns before this recipe existed) — durationSeconds: 240 clears its 15s heldSeconds trivially, same as every other scramble/fry use of a real cook time. No new safety wiring needed for this dish specifically; it inherited a safety net that already existed for a different reason."
  }
}
````

## File: data/recipes/salted-fried-potatoes.json
````json
{
  "id": "salted_fried_potatoes",
  "names": {
    "en": "Salted Fried Potatoes",
    "es": "Patatas Fritas Saladas"
  },
  "initialInventory": [
    { "id": "potato-1", "entityId": "potato", "state": "raw", "tags": [] },
    { "id": "oil-1", "entityId": "oil", "state": "cold", "tags": [] },
    {
      "id": "salt-1",
      "entityId": "salt",
      "state": "dry",
      "tags": [],
      "quantity": {
        "kind": "imprecise",
        "descriptor": "pinch",
        "approxRangeGrams": { "min": 0.3, "max": 0.6 },
        "citation": {
          "source": "Commonly cited culinary conversion: 1 pinch \u2248 1/16 tsp of fine table salt",
          "confidence": "commonly_cited_unverified",
          "note": "Genuinely imprecise by convention, not just uncited \u2014 cooks don't measure a pinch. Also varies by crystal size (fine vs. coarse), which this repo doesn't model as a separate entity yet \u2014 see QuantitySchema's doc comment (ingredient.ts)."
        }
      }
    }
  ],
  "availableTools": ["knife", "pan"],
  "sequence": [
    { "actionId": "wash", "targetInstanceId": "potato-1", "params": {}, "availableIngredientInstanceIds": [] },
    { "actionId": "peel", "targetInstanceId": "potato-1", "params": {}, "availableIngredientInstanceIds": [] },
    { "actionId": "cut", "targetInstanceId": "potato-1", "params": { "shape": "diced" }, "availableIngredientInstanceIds": [] },
    { "actionId": "fry", "targetInstanceId": "potato-1", "params": {}, "availableIngredientInstanceIds": ["oil-1"] },
    { "actionId": "salt", "targetInstanceId": "potato-1", "params": { "timing": "after_cooking" }, "availableIngredientInstanceIds": ["salt-1"] }
  ],
  "metadata": {
    "notes": "First concrete RecipeScript in the repo, tying together everything built incrementally: wash/peel/cut/fry/salt verbs, potato/oil/salt entities. The potato-1 that gets peeled also spawns a potato_peel-N instance (from PEEL's spawnsTargetByproducts) that this recipe doesn't do anything further with — it just sits in the final inventory, same as real leftover peel would."
  }
}
````

## File: data/recipes/soft-boiled-egg.json
````json
{
  "id": "soft_boiled_egg",
  "names": {
    "en": "Soft-Boiled Egg (jammy yolk, shocked and peeled)",
    "es": "Huevo Pasado por Agua (yema jugosa)"
  },
  "initialInventory": [
    { "id": "egg-1", "entityId": "egg", "state": "raw", "tags": [] },
    { "id": "water-1", "entityId": "water", "state": "cold", "tags": [] },
    {
      "id": "salt-1",
      "entityId": "salt",
      "state": "dry",
      "tags": [],
      "quantity": {
        "kind": "imprecise",
        "descriptor": "pinch",
        "approxRangeGrams": { "min": 0.3, "max": 0.6 },
        "citation": {
          "source": "Commonly cited culinary conversion: 1 pinch \u2248 1/16 tsp of fine table salt",
          "confidence": "commonly_cited_unverified",
          "note": "Genuinely imprecise by convention, not just uncited \u2014 cooks don't measure a pinch. Also varies by crystal size (fine vs. coarse), which this repo doesn't model as a separate entity yet \u2014 see QuantitySchema's doc comment (ingredient.ts)."
        }
      }
    }
  ],
  "availableTools": ["pot", "bowl", "knife"],
  "sequence": [
    {
      "actionId": "boil",
      "targetInstanceId": "egg-1",
      "params": { "durationSeconds": "390", "yolkDoneness": "soft" },
      "availableIngredientInstanceIds": ["water-1"]
    },
    { "actionId": "shock", "targetInstanceId": "egg-1", "params": {}, "availableIngredientInstanceIds": [] },
    { "actionId": "peel", "targetInstanceId": "egg-1", "params": {}, "availableIngredientInstanceIds": [] },
    { "actionId": "salt", "targetInstanceId": "egg-1", "params": { "timing": "after_cooking" }, "availableIngredientInstanceIds": ["salt-1"] }
  ],
  "metadata": {
    "notes": "390 seconds (6.5 minutes) is the classic jammy-yolk soft-boil window from a boiling-water start — but see shock.json's carryoverCookingNote: that duration alone doesn't guarantee the jammy result, SHOCK immediately afterward is what actually locks it in rather than letting residual heat push it further toward 'medium'/'hard'. Built specifically to demonstrate boil.json's belated durationSeconds/yolkDoneness parity fix and shock.json together, end to end, not just described.",
    "peelingNote": "PEEL runs right after SHOCK, not as an afterthought — shock.json's peelingNote is the real-world reason for that order: peeling a shocked egg is noticeably easier than one that cooled slowly, so this recipe's sequencing reflects actual technique, not just 'do the safety-relevant step whenever'."
  }
}
````

## File: data/recipes/tortilla-de-betanzos.json
````json
{
  "id": "tortilla_de_betanzos",
  "names": {
    "en": "Tortilla de Betanzos (liquid, flowing center)",
    "es": "Tortilla de Betanzos"
  },
  "initialInventory": [
    { "id": "potato-1", "entityId": "potato", "state": "raw", "tags": [] },
    { "id": "egg-1", "entityId": "egg", "state": "raw", "tags": [] },
    { "id": "oil-1", "entityId": "oil", "state": "cold", "tags": [] },
    {
      "id": "salt-1",
      "entityId": "salt",
      "state": "dry",
      "tags": [],
      "quantity": {
        "kind": "imprecise",
        "descriptor": "pinch",
        "approxRangeGrams": { "min": 0.3, "max": 0.6 },
        "citation": {
          "source": "Commonly cited culinary conversion: 1 pinch \u2248 1/16 tsp of fine table salt",
          "confidence": "commonly_cited_unverified",
          "note": "Genuinely imprecise by convention, not just uncited \u2014 cooks don't measure a pinch. Also varies by crystal size (fine vs. coarse), which this repo doesn't model as a separate entity yet \u2014 see QuantitySchema's doc comment (ingredient.ts)."
        }
      }
    }
  ],
  "availableTools": ["knife", "pan", "bowl"],
  "sequence": [
    { "actionId": "peel", "targetInstanceId": "potato-1", "params": {}, "availableIngredientInstanceIds": [] },
    { "actionId": "cut", "targetInstanceId": "potato-1", "params": { "shape": "sliced" }, "availableIngredientInstanceIds": [] },
    {
      "actionId": "fry",
      "targetInstanceId": "potato-1",
      "params": { "heatLevel": "low", "durationSeconds": "480" },
      "availableIngredientInstanceIds": ["oil-1"]
    },
    { "actionId": "crack", "targetInstanceId": "egg-1", "params": {}, "availableIngredientInstanceIds": [] },
    { "actionId": "beat", "targetInstanceId": "egg_cracked-3", "params": { "intensity": "well_beaten" }, "availableIngredientInstanceIds": [] },
    { "actionId": "salt", "targetInstanceId": "egg_cracked-3", "params": {}, "availableIngredientInstanceIds": ["salt-1"] },
    {
      "actionId": "combine",
      "targetInstanceId": "potato-1",
      "secondaryInstanceId": "egg_cracked-3",
      "params": {},
      "availableIngredientInstanceIds": []
    },
    {
      "actionId": "fry",
      "targetInstanceId": "tortilla_mixture-4",
      "params": { "heatLevel": "high", "durationSeconds": "12", "internalTexture": "baveuse" },
      "availableIngredientInstanceIds": ["oil-1"]
    },
    { "actionId": "flip", "targetInstanceId": "tortilla_mixture-4", "params": {}, "availableIngredientInstanceIds": [] },
    {
      "actionId": "fry",
      "targetInstanceId": "tortilla_mixture-4",
      "params": { "heatLevel": "high", "durationSeconds": "10", "internalTexture": "baveuse" },
      "availableIngredientInstanceIds": ["oil-1"]
    }
  ],
  "metadata": {
    "notes": "The defining trait of tortilla de Betanzos (A Coruña, Galicia) is NOT flatness or fold — it's an intentionally liquid, flowing interior ('que sea como una salsa'), the opposite end of internalTexture's spectrum from tortilla-francesa.json's 'fully_set'. Achieved here with 'baveuse' + high heat + genuinely brief cook time (12s, then 10s after FLIP) — a sear to set the outside only, not a real cook-through. Same COMBINE/FLIP machinery as tortilla-de-patatas.json, same entity — the difference between 'classic' and 'Betanzos' is entirely in the FRY parameters chosen at the last two steps, exactly the kind of comparison this vocabulary was built to make explicit rather than requiring two separately-invented dishes.",
    "haccpNote": "This is the FIRST real recipe to actually exercise tortilla_mixture.json's criticalControlPointsByAction (added directly in response to this dish being requested — it didn't exist before, a real, previously-unfound gap, not a hypothetical). 12s and 10s are both genuinely below egg_cooking.json's 15s heldSeconds — run this and expect WARNINGS, not a rejection: egg_cooking.json is advisoryOnly:true, the same 'increased risk, disclosed' FDA posture as a runny fried egg, not the hard-reject posture egg_pasteurization_raw.json/egg_pasteurization_liquid.json use for genuinely raw, never-heated yolk. A liquid-centered tortilla that WAS seared on both sides is a materially different, lower-risk case than raw yolk that was never heated at all — this recipe is intentionally the advisory case, not the hard-reject one, and the CCP posture correctly reflects that distinction rather than treating all under-15s outcomes identically.",
    "comparisonNote": "Run tortilla_de_patatas.json (classic, 180s/120s, comfortably clears 15s, zero warnings) immediately before or after this one — same COMBINE/FLIP machinery, same entities, genuinely different real dish, now provably different (a warning fires for one and not the other) rather than just differently-named."
  }
}
````

## File: data/recipes/tortilla-de-patatas.json
````json
{
  "id": "tortilla_de_patatas",
  "names": {
    "en": "Spanish Tortilla (sin cebolla)",
    "es": "Tortilla de Patatas (sin cebolla)"
  },
  "initialInventory": [
    { "id": "potato-1", "entityId": "potato", "state": "raw", "tags": [] },
    { "id": "egg-1", "entityId": "egg", "state": "raw", "tags": [] },
    { "id": "oil-1", "entityId": "oil", "state": "cold", "tags": [] },
    {
      "id": "salt-1",
      "entityId": "salt",
      "state": "dry",
      "tags": [],
      "quantity": {
        "kind": "imprecise",
        "descriptor": "pinch",
        "approxRangeGrams": { "min": 0.3, "max": 0.6 },
        "citation": {
          "source": "Commonly cited culinary conversion: 1 pinch \u2248 1/16 tsp of fine table salt",
          "confidence": "commonly_cited_unverified",
          "note": "Genuinely imprecise by convention, not just uncited \u2014 cooks don't measure a pinch. Also varies by crystal size (fine vs. coarse), which this repo doesn't model as a separate entity yet \u2014 see QuantitySchema's doc comment (ingredient.ts)."
        }
      }
    }
  ],
  "availableTools": ["knife", "pan", "bowl"],
  "sequence": [
    { "actionId": "peel", "targetInstanceId": "potato-1", "params": {}, "availableIngredientInstanceIds": [] },
    { "actionId": "cut", "targetInstanceId": "potato-1", "params": { "shape": "sliced" }, "availableIngredientInstanceIds": [] },
    {
      "actionId": "fry",
      "targetInstanceId": "potato-1",
      "params": { "heatLevel": "low", "durationSeconds": "900" },
      "availableIngredientInstanceIds": ["oil-1"]
    },
    { "actionId": "crack", "targetInstanceId": "egg-1", "params": {}, "availableIngredientInstanceIds": [] },
    { "actionId": "beat", "targetInstanceId": "egg_cracked-3", "params": { "intensity": "beaten" }, "availableIngredientInstanceIds": [] },
    { "actionId": "salt", "targetInstanceId": "egg_cracked-3", "params": { "timing": "before_cooking" }, "availableIngredientInstanceIds": ["salt-1"] },
    {
      "actionId": "combine",
      "targetInstanceId": "potato-1",
      "secondaryInstanceId": "egg_cracked-3",
      "params": {},
      "availableIngredientInstanceIds": []
    },
    {
      "actionId": "fry",
      "targetInstanceId": "tortilla_mixture-4",
      "params": { "heatLevel": "medium", "durationSeconds": "180" },
      "availableIngredientInstanceIds": ["oil-1"]
    },
    { "actionId": "flip", "targetInstanceId": "tortilla_mixture-4", "params": {}, "availableIngredientInstanceIds": [] },
    {
      "actionId": "fry",
      "targetInstanceId": "tortilla_mixture-4",
      "params": { "heatLevel": "medium", "durationSeconds": "120" },
      "availableIngredientInstanceIds": ["oil-1"]
    }
  ],
  "metadata": {
    "notes": "The recipe ROADMAP.md's capability test named as blocked, now run end-to-end: PEEL/CUT/FRY the potato (low heat, long duration — soft-fried, deliberately not browned, real technique); CRACK/BEAT/SALT the egg; COMBINE merges the two fried-potato and beaten-egg instances into ONE new tortilla_mixture instance (both consumed — verify in the log: potato-1 and egg_cracked-3 are both gone from final inventory); FRY the mixture, FLIP it, FRY the other side. Onion-free (sin cebolla) — no onion entity exists in this vocabulary yet, and it's a legitimate traditional variant on its own, not a workaround.",
    "instanceIdNote": "targetInstanceId 'egg_cracked-3'/'tortilla_mixture-4' aren't in initialInventory — they're ids CRACK/COMBINE spawn at runtime (recipe-runner.ts's spawnCounter), matching the same convention salted-fried-potatoes.json already uses for potato_peel-1. validate.ts logs a NOTE for these, not a failure — see that script's own comment on why spawned ids can't be verified statically."
  }
}
````

## File: data/recipes/tortilla-francesa.json
````json
{
  "id": "tortilla_francesa",
  "names": {
    "en": "Tortilla Francesa (Spanish plain omelette — flat, fully set)",
    "es": "Tortilla Francesa"
  },
  "initialInventory": [
    { "id": "egg-1", "entityId": "egg", "state": "raw", "tags": [] },
    { "id": "oil-1", "entityId": "oil", "state": "cold", "tags": [] },
    {
      "id": "salt-1",
      "entityId": "salt",
      "state": "dry",
      "tags": [],
      "quantity": {
        "kind": "imprecise",
        "descriptor": "pinch",
        "approxRangeGrams": { "min": 0.3, "max": 0.6 },
        "citation": {
          "source": "Commonly cited culinary conversion: 1 pinch \u2248 1/16 tsp of fine table salt",
          "confidence": "commonly_cited_unverified",
          "note": "Genuinely imprecise by convention, not just uncited \u2014 cooks don't measure a pinch. Also varies by crystal size (fine vs. coarse), which this repo doesn't model as a separate entity yet \u2014 see QuantitySchema's doc comment (ingredient.ts)."
        }
      }
    }
  ],
  "availableTools": ["pan", "bowl"],
  "sequence": [
    { "actionId": "crack", "targetInstanceId": "egg-1", "params": {}, "availableIngredientInstanceIds": [] },
    { "actionId": "beat", "targetInstanceId": "egg_cracked-2", "params": { "intensity": "beaten" }, "availableIngredientInstanceIds": [] },
    { "actionId": "salt", "targetInstanceId": "egg_cracked-2", "params": { "timing": "before_cooking" }, "availableIngredientInstanceIds": ["salt-1"] },
    {
      "actionId": "fry",
      "targetInstanceId": "egg_cracked-2",
      "params": { "heatLevel": "medium", "durationSeconds": "180", "agitation": "undisturbed", "internalTexture": "fully_set" },
      "availableIngredientInstanceIds": ["oil-1"]
    }
  ],
  "metadata": {
    "notes": "The everyday Spanish 'tortilla francesa': despite the name, NOT the classical French folded omelette — see fry.json's internalTextureNote for the real disambiguation this recipe exists to demonstrate concretely. internalTexture: 'fully_set' (cooked all the way through) and agitation: 'undisturbed' (held flat as a sheet, matching a real omelette rather than scrambled curds), no FOLD step at all — served flat. Compare directly against french-omelette.json, which shares this recipe's first three steps exactly and diverges only at the final FRY's parameters plus an added FOLD step."
  }
}
````

## File: scripts/cook-potato-three-ways.ts
````typescript
import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));

function apply(
  instance: Instance,
  actionId: string,
  availableTools: ReadonlySet<string>,
  availableIngredients?: ReadonlySet<string>
): Instance {
  const action = actions.get(actionId);
  if (!action) throw new Error(`Unknown action "${actionId}"`);
  const result = applyAction(instance, action, entities, availableTools, undefined, availableIngredients);
  console.log(`  ${action.verb}: "${instance.state}" -> "${result.instance.state}"`);
  return result.instance;
}

function washedAndPeeledPotato(): Instance {
  let potato: Instance = { entityId: "potato", state: "raw", tags: [] };
  potato = apply(potato, "wash", new Set(["knife"]));
  potato = apply(potato, "peel", new Set(["knife"]));
  return potato;
}

console.log("Boiled (cooked in water, pot):");
const boiled = apply(washedAndPeeledPotato(), "boil", new Set(["pot"]), new Set(["water"]));

console.log("\nFried (cooked in oil, pan):");
const fried = apply(washedAndPeeledPotato(), "fry", new Set(["pan"]), new Set(["oil"]));

console.log("\nBaked (dry heat, oven — no medium at all):");
const baked = apply(washedAndPeeledPotato(), "bake", new Set(["oven"]));

console.log("\nMixed method — parboiled, then fried:");
let mixed = washedAndPeeledPotato();
mixed = apply(mixed, "boil", new Set(["pot"]), new Set(["water"]));
mixed = apply(mixed, "fry", new Set(["pan"]), new Set(["oil"]));

console.log("\nThese are not the same result:");
console.log(`  boiled only:    "${boiled.state}"`);
console.log(`  fried only:     "${fried.state}"`);
console.log(`  baked only:     "${baked.state}"`);
console.log(
  `  boiled + fried: "${mixed.state}"  (passed through "boiled" first — visible in the log above, ` +
    `but the instance itself only tracks its current state, not the method history that got it there)`
);
````

## File: scripts/egg-haccp.ts
````typescript
import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { applyAction, type Instance, type SafetyPolicy } from "../src/engine.ts";

/**
 * Demonstrates the HACCP check wired into FRY/SCRAMBLE/POACH/BOIL on eggs
 * (data/ccps/egg_cooking.json, criticalControlPointsByAction), and —
 * ENGINE_INVARIANTS.md #11 — how SafetyPolicy changes what happens to an
 * advisoryOnly shortfall depending on who's actually driving:
 *
 * 1. human execution, 10s flash fry: warns, completes (a person can judge
 *    a runny yolk for themselves — the FDA Food Code's actual posture).
 * 2. autonomous execution, same 10s flash fry, no override: hard rejects.
 *    No human present to make that judgment call, so the safe default
 *    wins, not the permissive one.
 * 3. autonomous execution, same shortfall, WITH an explicit prior
 *    human authorization for this exact CCP: proceeds, but the fact that
 *    it was overridden stays visible in the warning text — not silently
 *    absorbed into "no warnings".
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));

const tools = new Set(["pan"]);
const ingredients = new Set(["oil"]);

function fry(instance: Instance, durationSeconds: number, policy?: SafetyPolicy) {
  const action = actions.get("fry")!;
  const result = applyAction(
    instance,
    action,
    entities,
    tools,
    { durationSeconds: String(durationSeconds), heatLevel: "medium" },
    ingredients,
    ccps,
    policy
  );
  console.log(`FRY for ${durationSeconds}s: "${instance.state}" -> "${result.instance.state}"`);
  if (result.warnings.length === 0) {
    console.log("  No HACCP warnings.");
  } else {
    for (const w of result.warnings) console.log(`  WARNING: ${w}`);
  }
  return result;
}

console.log("=== 1. Human execution (default policy) ===");
console.log("--- A normal fried egg, 120 seconds ---");
fry({ entityId: "egg", state: "raw", tags: [] }, 120);

console.log("\n--- A deliberately unrealistic 10-second flash fry ---");
const humanFlash = fry({ entityId: "egg", state: "raw", tags: [] }, 10);
console.log(`Completed: state "${humanFlash.instance.state}". The warning is informational — a human reads it and judges.`);

console.log("\n=== 2. Autonomous execution, same 10s flash fry, no override ===");
try {
  fry({ entityId: "egg", state: "raw", tags: [] }, 10, { mode: "autonomous" });
  console.log("UNEXPECTED: did not reject");
} catch (err) {
  console.log(`REJECTED as expected — no human present to accept this risk:\n  ${(err as Error).message}`);
}

console.log("\n=== 3. Autonomous execution, same shortfall, WITH a prior human override for this CCP ===");
fry({ entityId: "egg", state: "raw", tags: [] }, 10, { mode: "autonomous", humanOverrides: new Set(["egg_cooking"]) });

console.log(
  "\nSame underlying shortfall, three different outcomes depending on SafetyPolicy — " +
    "ENGINE_INVARIANTS.md #11: autonomous execution defaults safe, not permissive, and stays that way " +
    "until a human explicitly says otherwise for that specific CCP, not as a blanket switch."
);
````

## File: scripts/mix-potato-peel.ts
````typescript
import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance, type ExecutionResult } from "../src/engine.ts";

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const availableTools = new Set(["knife", "mixer"]);

function apply(
  instance: Instance,
  actionId: string,
  params?: Record<string, string>
): ExecutionResult {
  const action = actions.get(actionId);
  if (!action) throw new Error(`Unknown action "${actionId}"`);
  console.log(`Applying ${action.verb} to ${instance.entityId} (state: "${instance.state}")`);
  const result = applyAction(instance, action, entities, availableTools, params);
  console.log(`  -> ${instance.entityId} is now "${result.instance.state}"`);
  for (const s of result.spawned) console.log(`  -> spawned ${s.entityId} (state: "${s.state}")`);
  return result;
}

let potato: Instance = { entityId: "potato", state: "raw", tags: [] };
({ instance: potato } = apply(potato, "wash"));

const peelResult = apply(potato, "peel");
potato = peelResult.instance;
const peel = peelResult.spawned.find((s) => s.entityId === "potato_peel");
if (!peel) throw new Error("Expected 'peel' to spawn a potato_peel byproduct");

console.log("\nThis time, instead of frying the peel, put it in a mixer:");
const blendedPeel = apply(peel, "mix").instance;

console.log("\nFinal inventory:");
console.log(`  potato: ${potato.state}`);
console.log(`  potato_peel: ${blendedPeel.state}`);
````

## File: scripts/run-recipe.ts
````typescript
import { join } from "node:path";
import { loadEntities, loadActions, loadRecipes, loadCcps } from "../src/registry.ts";
import { runRecipe } from "../src/recipe-runner.ts";

const recipeId = process.argv[2] ?? "salted_fried_potatoes";

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const recipes = loadRecipes(join(root, "data", "recipes"));
const ccps = loadCcps(join(root, "data", "ccps"));

const recipe = recipes.get(recipeId);
if (!recipe) {
  throw new Error(`Unknown recipe "${recipeId}". Known: ${[...recipes.keys()].join(", ")}`);
}

console.log(`Running "${recipe.names.en}"\n`);
const result = runRecipe(recipe, entities, actions, ccps);

for (const line of result.log) console.log(line);

console.log("\nFinal inventory:");
for (const [id, instance] of result.finalInventory) {
  const tagsLabel = instance.tags.length ? `, tags [${instance.tags}]` : "";
  console.log(`  ${id}: ${instance.entityId}, state "${instance.state}"${tagsLabel}`);
}

if (result.errors.length > 0) {
  console.log(`\n${result.errors.length} step(s) failed:`);
  for (const { step, message } of result.errors) {
    console.log(`  ${step.actionId} on ${step.targetInstanceId}: ${message}`);
  }
  process.exit(1);
}
````

## File: scripts/wash-and-peel-potato.ts
````typescript
import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));

const availableTools = new Set(["knife"]);

let potato: Instance = { entityId: "potato", state: "raw", tags: [] };
const inventory: Instance[] = [potato];

for (const actionId of ["wash", "peel"]) {
  const action = actions.get(actionId);
  if (!action) throw new Error(`Unknown action "${actionId}"`);

  console.log(`Applying ${action.verb} to ${potato.entityId} (state: "${potato.state}")`);
  const result = applyAction(potato, action, entities, availableTools);

  potato = result.instance;
  inventory[0] = potato;
  inventory.push(...result.spawned);

  console.log(`  -> ${potato.entityId} is now "${potato.state}"`);
  for (const spawned of result.spawned) {
    console.log(`  -> spawned ${spawned.entityId} (state: "${spawned.state}")`);
  }
}

console.log("\nFinal inventory:");
for (const item of inventory) {
  console.log(`  ${item.entityId}: ${item.state}`);
}
````

## File: src/heat-source.ts
````typescript
import { z } from "zod";
import { CitationSchema } from "./ingredient.ts";

/**
 * HeatSourceProfileSchema — real, cited performance facts about a physical
 * heat provider (a gas burner, a ceramic-glass "vitro" radiant hob, an open
 * wood fire, ...). Added 2026-08-13 in direct response to "how long does
 * boiling an egg take on gas vs. vitro vs. wood" — the same class of
 * question `thermal.ts`'s `CriticalControlPointSchema` answers for pathogen
 * safety, but for a genuinely different physical question (heating RATE,
 * not kill-time), so it's its own file/collection (`data/heat-sources/*.json`,
 * `registry.ts`'s `loadHeatSources`) rather than bolted onto
 * `CriticalControlPointSchema` or `EntitySchema` — same reasoning
 * `thermal.ts`'s own doc comment gives for why CCPs are a separate top-level
 * knowledge collection, not a field grafted onto whatever entity happens to
 * need one.
 *
 * THE ONE FACT THIS SCHEMA MUST GET RIGHT, EXPLICITLY, BECAUSE IT'S A REAL
 * COMMON MISCONCEPTION: which heat source you use does NOT change the
 * temperature water boils at. Boiling point is a function of PRESSURE
 * (altitude) only — see `water.json`'s own citation note — never of how
 * vigorously or with what equipment the water is heated. A rolling boil on
 * a roaring wood fire and a bare simmer on a low gas flame are BOTH water at
 * ~100°C at sea level; the fire just makes it reach and maintain that
 * temperature faster/slower and more or less steadily. What a heat source
 * actually changes is (1) how long it takes to REACH boiling from a cold
 * start (`estimatedPreheatSeconds` below), and (2) how precisely a cook can
 * hold a target temperature/simmer once there (`controlPrecision`) — never
 * the target temperature itself. Modeling heat source as changing the
 * required BOIL `durationSeconds` (the time spent AT temperature, which is
 * what actually cooks the egg / clears a CCP) would be physically wrong;
 * this schema deliberately stays out of that number's way.
 *
 * ALSO SCIENTIFICALLY IMPORTANT, added when asked directly to not overstate
 * precision here: delivered heat is a real, continuously time-varying curve
 * for every one of these sources, never a constant — most obviously for
 * wood (a fire's output drifts on its own between deliberate adjustments,
 * see wood_fire.json), but genuinely also true for gas and vitro during
 * their own startup ramp and any manual adjustment. `typicalPowerWattsRange`/
 * `thermalEfficiencyPercentRange` and `estimatedPreheatSeconds` below use a
 * SINGLE constant average value across the whole heating interval — a
 * first-order energy-balance estimate (total energy delivered roughly equal
 * to total energy needed), not a differential simulation of the actual
 * curve. That's a deliberate, stated depth limit (a real curve model would
 * need transient thermal-mass/heat-loss dynamics this repo has no reason to
 * build yet), not an oversight — see `estimatedPreheatSeconds`'s own doc
 * comment for exactly what the approximation does and doesn't capture.
 *
 * A skilled cook's actual fine control over delivered heat is NOT limited
 * to the source's own dial/damper either: physically moving the pan itself
 * — off direct flame, to a cooler edge of a fire, lifting it entirely for a
 * few seconds — is a real, separate control technique, most essential on
 * wood fire (where the fire itself often can't be finely dialed at all, so
 * pan position IS the primary fine control) but genuinely used on gas too.
 * `manualPositioningRelevance` records how load-bearing that technique
 * typically is for a given source; it does not attempt to model the
 * technique's actual thermal effect (how much cooler "the edge of the fire"
 * actually is, precisely) — naming a real, unmodeled control axis honestly
 * beats pretending `controlPrecision` above already accounts for it.
 */
export const HeatSourceProfileSchema = z.object({
  id: z.string().min(1),
  names: z.record(z.string(), z.string()).refine((n) => "en" in n, {
    message: "names must at least include an 'en' entry",
  }),
  /** Realistic delivered-power range for a single home burner/ring/fire, in
   *  watts — a range, not one number, because even "the same" heat source
   *  varies by unit size/setting (and, for wood, hugely by fire size). */
  typicalPowerWattsRange: z.object({ min: z.number().positive(), max: z.number().positive() }),
  /** What fraction of that power actually reaches the pot's contents rather
   *  than escaping around the sides / radiating away — the real reason gas
   *  and wood need much more raw power than vitro/induction to deliver the
   *  same heat to the food. 0-100. */
  thermalEfficiencyPercentRange: z.object({ min: z.number().positive().max(100), max: z.number().positive().max(100) }),
  /** How quickly the delivered heat actually changes when the cook adjusts
   *  the control (or the fire changes on its own) — NOT the same thing as
   *  power. Vitro is "slow" despite being a controllable dial specifically
   *  because the ceramic glass + coil underneath has real thermal mass/lag;
   *  gas is "instant" because a flame's size visibly and immediately tracks
   *  the knob; wood is "highly_variable" because it isn't a dial at all —
   *  airflow/fuel state drift on their own between deliberate adjustments. */
  responseSpeed: z.enum(["instant", "fast", "slow", "highly_variable"]),
  controlPrecision: z.enum(["precise", "moderate", "coarse"]),
  /** How much a skilled cook typically relies on physically repositioning
   *  the pan (not just adjusting the source's own control) to fine-tune
   *  delivered heat — see this schema's top doc comment. "high" for wood
   *  (often the ONLY fine control available), "low" for vitro (there's
   *  usually nowhere cooler to move a pan TO on a flat zoned surface). */
  manualPositioningRelevance: z.enum(["low", "moderate", "high"]),
  citation: CitationSchema,
  note: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type HeatSourceProfile = z.infer<typeof HeatSourceProfileSchema>;

/**
 * Real physics (Q = mcΔT, time = Q / deliveredPower), the same
 * "implement the actual textbook formula instead of a hand-picked anchor"
 * move `thermal.ts`'s `requiredHoldSeconds` made for pathogen kill-time —
 * applied here to a genuinely different question (how long to REACH a
 * target temperature from a cold start, not how long to HOLD one).
 *
 * Deliberately a standalone, uncalled-by-anything-yet utility — like
 * `requiredHoldSeconds` was before `engine.ts`'s CCP check adopted it, this
 * is real, checkable knowledge available for a recipe-authoring/planning
 * layer to use, not something `applyAction` consumes today (ROADMAP.md:
 * "don't worry about the engine yet"). It answers "how long," never
 * "what temperature" — see this file's own top doc comment for why the
 * target temperature (100°C at sea level for boiling water) must NOT be a
 * function of which heat source is used.
 *
 * `waterSpecificHeatJPerKgK` defaults to water's real, standard value
 * (4186 J/(kg·K), CRC Handbook) rather than requiring every caller to pass
 * it — see `water.json`'s `thermophysical.specificHeatJPerKgK`.
 *
 * WHAT THIS DOES vs. DOES NOT CAPTURE, stated explicitly rather than left
 * implicit (the same "don't imply more precision than was verified"
 * standard this repo already holds citations to): it computes a single
 * energy-balance estimate using ONE constant power/efficiency value for the
 * whole interval. It does NOT model: the real startup ramp (a burner isn't
 * at full output the instant it's lit), heat lost to the pot/room while
 * heating (some of the energy budgeted here never reaches the water),
 * moment-to-moment fluctuation (especially wood fire — see
 * `wood_fire.json`), or a cook's manual pan-repositioning compensating for
 * any of the above (`manualPositioningRelevance`). Treat the return value as
 * a rough, physically-grounded ESTIMATE for planning purposes ("wood will
 * take noticeably longer than gas"), not a precise prediction a robot
 * should treat as a countdown timer.
 */
export function estimatedPreheatSeconds(
  waterMassKg: number,
  initialTempC: number,
  targetTempC: number,
  heatSource: HeatSourceProfile,
  /** Pick the representative (midpoint) power/efficiency within the
   *  source's range — a single best estimate, not a min/max pair, since
   *  callers generally want one number to reason about, not a further
   *  range to propagate. Callers wanting the full spread can compute the
   *  min/max cases directly from `heatSource`'s own range fields. */
  waterSpecificHeatJPerKgK = 4186
): number {
  if (targetTempC <= initialTempC) {
    throw new Error(`targetTempC (${targetTempC}) must be above initialTempC (${initialTempC})`);
  }
  const energyRequiredJ = waterMassKg * waterSpecificHeatJPerKgK * (targetTempC - initialTempC);
  const midPowerW = (heatSource.typicalPowerWattsRange.min + heatSource.typicalPowerWattsRange.max) / 2;
  const midEfficiency =
    (heatSource.thermalEfficiencyPercentRange.min + heatSource.thermalEfficiencyPercentRange.max) / 2 / 100;
  const deliveredPowerW = midPowerW * midEfficiency;
  return energyRequiredJ / deliveredPowerW;
}
````

## File: src/thermal.ts
````typescript
import { z } from "zod";

/**
 * The standard microbiological thermal-death-time model — D-value/z-value
 * kinetics, the actual math the FDA Food Code's own multi-point tables were
 * derived from (this is not a novel formula, it's textbook thermobacteriology:
 * Stumbo's thermal death time model). One cited (temperature, required-hold-
 * time) reference pair, plus a z-value (the °C rise that cuts the required
 * hold time by a factor of 10), lets the required time be COMPUTED at any
 * actual temperature — replacing "pick more fixed anchor points if you need
 * more temperature options" with one formula that covers the whole curve.
 *
 * `requiredHoldSeconds` below is the formula:
 *   t(T) = referenceHoldSeconds × 10^((referenceTempC − T) / zValueC)
 *
 * CRITICAL VALIDITY CONDITION, not a footnote: this model assumes the
 * PRODUCT is at the stated temperature, not just the surrounding medium. It
 * is only honestly applicable when the product reaches medium temperature
 * quickly — thin, liquid, well-mixed, no insulating barrier (e.g. already-
 * separated liquid egg yolk in a shallow water bath). It is NOT valid for a
 * whole egg still in its shell: the shell measurably slows heat penetration
 * to the interior, so "water bath at T" does not mean "yolk at T" for a
 * significant initial period. Using this formula against water-bath
 * temperature for an in-shell process would understate the required time.
 * `validityCondition` on each instance states this explicitly per use, not
 * just here.
 */
export const ThermalInactivationModelSchema = z.object({
  referenceTempC: z.number(),
  /** Minimum hold time (seconds) at referenceTempC — a real, cited
   *  regulatory or published figure, not a derived/computed one. */
  referenceHoldSeconds: z.number().positive(),
  zValueC: z.number().positive(),
  /** States explicitly what physical assumption must hold for this specific
   *  use of the model to be valid — see the doc comment above. */
  validityCondition: z.string().min(1),
  source: z.string().min(1),
});
export type ThermalInactivationModel = z.infer<typeof ThermalInactivationModelSchema>;

export function requiredHoldSeconds(model: ThermalInactivationModel, actualTempC: number): number {
  return model.referenceHoldSeconds * Math.pow(10, (model.referenceTempC - actualTempC) / model.zValueC);
}

/**
 * CriticalControlPointSchema — ROADMAP.md Phase 2's HACCP model
 * (CLAUDE_DEV_CTX.md: "thermal steps must enforce safety thresholds, e.g.
 * holding a minimum internal temperature of 135°F for at least 15 seconds").
 *
 * Grounded in the FDA Food Code's actual time-temperature-equivalence
 * pattern (§3-401.11): a pathogen can be reduced to a safe level either by
 * an instantaneous higher temperature, OR a lower temperature held for a
 * minimum time — the same log-reduction, two different paths. This schema
 * models exactly those two points (`instantaneousC` and `heldC`/
 * `heldSeconds`), not the full multi-point curve the real Food Code table
 * specifies (which has many more (temperature, time) pairs between those
 * two extremes) — reconstructing that whole curve from memory risked
 * quietly-wrong numbers, so this stops at the two anchor points that are
 * confidently, commonly published (see data/ccps/*.json `source` fields).
 * `thermalModel` (optional, below) is the real, computable escape hatch from
 * that limitation where it's honestly applicable — see its own doc comment.
 *
 * `advisoryOnly` captures a real regulatory nuance, not a simplification:
 * the FDA Food Code explicitly permits some animal-food dishes served
 * below the CCP (a still-runny egg yolk) as a recognized "increased risk"
 * consumer-advisory practice, not a banned one. engine.ts treats a
 * shortfall against an advisoryOnly CCP as a warning, not a hard reject.
 */
export const CriticalControlPointSchema = z.object({
  id: z.string().min(1),
  names: z.record(z.string(), z.string()).refine((n) => "en" in n, {
    message: "names must at least include an 'en' entry",
  }),
  /** Reach-and-hold-for-an-instant target, °C. */
  instantaneousC: z.number(),
  /** Lower alternative target, °C, valid only if held for `heldSeconds`. */
  heldC: z.number(),
  heldSeconds: z.number().positive(),
  /** The organism this threshold is sized against, e.g. "Salmonella spp." */
  pathogen: z.string().min(1),
  /** See doc comment above — engine.ts warns instead of rejecting when true. */
  advisoryOnly: z.boolean().default(false),
  /** Citation for instantaneousC/heldC/heldSeconds — required, not optional:
   *  an unsourced number here is exactly the "quietly-wrong" failure mode
   *  this schema exists to avoid. */
  source: z.string().min(1),
  /** Optional: the real, computable model behind the two fixed anchor points
   *  above. When present AND the step supplies an actual temperature
   *  parameter (waterTempC), engine.ts uses this to compute the required
   *  hold time at THAT exact temperature instead of only ever checking
   *  against the one fixed heldC/heldSeconds pair. Absent for CCPs where no
   *  real temperature parameter exists to compute against (FRY/BOIL/
   *  SCRAMBLE only have categorical heatLevel, not a real °C value) — the
   *  fixed two-point check is the honest ceiling for those, not a
   *  placeholder waiting to be upgraded. */
  thermalModel: ThermalInactivationModelSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type CriticalControlPoint = z.infer<typeof CriticalControlPointSchema>;
````

## File: tests/ingredient.test.ts
````typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { EntitySchema, CitationSchema, StructureSchema, QuantitySchema } from "../src/ingredient.ts";
import { makeEntity } from "./helpers.ts";

describe("EntitySchema", () => {
  test("names must include an 'en' entry", () => {
    assert.throws(() =>
      EntitySchema.parse({ id: "potato", kind: "ingredient", names: { es: "Patata" }, aggregationState: "solid" })
    );
  });

  test("structure/possibleStates/possibleTags/byproductsByAction/capabilities all default sensibly", () => {
    const e = makeEntity({ id: "salt" });
    assert.deepEqual(e.structure, { composite: false, components: [] });
    assert.deepEqual(e.possibleStates, []);
    assert.deepEqual(e.possibleTags, []);
    assert.deepEqual(e.byproductsByAction, {});
    assert.deepEqual(e.criticalControlPointsByAction, {});
    assert.deepEqual(e.capabilities, {});
  });

  test("capabilities is an open map — an unrecognized key still parses (dynamic capability inference)", () => {
    const e = makeEntity({ id: "mystery_root", capabilities: { isFooBarable: true } as any });
    assert.equal((e.capabilities as any).isFooBarable, true);
  });

  test("kind distinguishes ingredient from tool", () => {
    const knife = makeEntity({ id: "knife", kind: "tool" });
    assert.equal(knife.kind, "tool");
    assert.throws(() => makeEntity({ id: "bad", kind: "vegetable" as any }));
  });
});

describe("CitationSchema", () => {
  test("confidence is restricted to the two honest tiers — no 'primary_source' escape hatch", () => {
    assert.throws(() =>
      CitationSchema.parse({ source: "USDA FoodData Central", confidence: "primary_source" })
    );
    assert.doesNotThrow(() =>
      CitationSchema.parse({ source: "USDA FoodData Central", confidence: "standard_reference" })
    );
    assert.doesNotThrow(() =>
      CitationSchema.parse({ source: "commonly taught", confidence: "commonly_cited_unverified" })
    );
  });
});

describe("StructureSchema", () => {
  test("defaults to non-composite with no components when omitted entirely", () => {
    assert.deepEqual(StructureSchema.parse(undefined), { composite: false, components: [] });
  });
});

describe("QuantitySchema", () => {
  test("'precise' requires a positive amount and a real unit", () => {
    assert.doesNotThrow(() => QuantitySchema.parse({ kind: "precise", amount: 5, unit: "g" }));
    assert.throws(() => QuantitySchema.parse({ kind: "precise", amount: 0, unit: "g" }));
    assert.throws(() => QuantitySchema.parse({ kind: "precise", amount: 5, unit: "smidgen" }));
  });

  test("'imprecise' takes a real culinary descriptor, not an arbitrary string, and doesn't require a gram range", () => {
    assert.doesNotThrow(() => QuantitySchema.parse({ kind: "imprecise", descriptor: "pinch" }));
    assert.throws(() => QuantitySchema.parse({ kind: "imprecise", descriptor: "a bit" }));
  });

  test("'imprecise' approxRangeGrams, when given, is non-authoritative reference context, not a hard number", () => {
    const q = QuantitySchema.parse({
      kind: "imprecise",
      descriptor: "pinch",
      approxRangeGrams: { min: 0.3, max: 0.6 },
      citation: { source: "commonly cited conversion", confidence: "commonly_cited_unverified" },
    });
    if (q.kind !== "imprecise") throw new Error("expected imprecise");
    assert.deepEqual(q.approxRangeGrams, { min: 0.3, max: 0.6 });
  });

  test("'relative' expresses a ratio against another entity — e.g. baker's-percentage salt", () => {
    const q = QuantitySchema.parse({ kind: "relative", ratio: 0.02, ofEntityId: "flour" });
    if (q.kind !== "relative") throw new Error("expected relative");
    assert.equal(q.ratio, 0.02);
    assert.equal(q.ofEntityId, "flour");
    assert.equal(q.basis, "mass", "basis defaults to mass, not count");
  });

  test("an unrecognized 'kind' is rejected — not silently accepted as a 4th shape", () => {
    assert.throws(() => QuantitySchema.parse({ kind: "vague", amount: 1 }));
  });
});
````

## File: .gitignore
````
# Node / TypeScript
node_modules/
dist/
build/
*.tsbuildinfo
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Python
__pycache__/
*.py[cod]
.venv/
venv/
*.egg-info/

# React Native / Expo
.expo/
.expo-shared/

# Editors / OS
.vscode/*
!.vscode/extensions.json
.DS_Store

# Windows download marker (from files pulled in via browser/WSL)
*:Zone.Identifier

# Env / secrets
.env
.env.*
!.env.example

# graft's local graph cache — regenerable, not committed (run `graft build`).
graft/
````

## File: CONCEPT.md
````markdown
# CONCEPT.md — Tortilla World

> Captured from `masideas.md` (raw outline/notes). This is a structured write-up of that outline, not a finished spec — sections marked **TODO (from source)** were only a heading in the original notes and still need real content. This document was **not** reconciled with `CLAUDE_DEV_CTX.md` / `Culinary_Informatics_Research_Plan.pdf` / `ROADMAP.md`, which build around a linear step-sequence recipe model that this outline explicitly argues against (see §12), for most of this project's life. **Resolved 2026-08-12 — see `WORLD_MODEL.md`**: the world (§10's event-sourced objects, undergoing continuous physical/chemical transformation) is the primary representation; a recipe is one layer of intent on top, not the core. The linear-sequence machinery already built (`Action`/`Entity`/`RecipeScript`/`engine.ts`) isn't discarded — `WORLD_MODEL.md` argues it's already shaped like a planning domain (preconditions/effects) that a not-yet-built planner would search over, with a completed run's trace being exactly this section's Timeline.

Working title: **Tortilla World**. Philosophy, per the source notes: *"Grandma First, Machine Deep"* — recipes are authored the way a person actually talks about cooking; the mechanical/scientific structure lives underneath, never the other way around.

## 1–2. Premise

**Knowledge > Instructions.**

- Ingredients know themselves.
- Tools know themselves.
- Actions know themselves.
- Recipes should contain as little knowledge as possible.

A recipe is not where cooking knowledge lives — it's a thin declarative pointer into knowledge that lives on ingredients, tools, and actions.

## 3. Core Principles

- **Knowledge is immutable.** (the canonical definition of "what an onion is" doesn't change at runtime)
- **Instances are mutable.** (*this* onion, on the cutting board, changes state)
- **Recipes are declarative.**
- **Everything is replayable.**
- **Everything is deterministic.**
- **Unknown knowledge is allowed.** (the world must not break when it meets an ingredient/action/state it doesn't recognize — see §15)

## 4. The World

**TODO (from source):** needs real content + diagrams. The outline names these as the entities that exist in the world, undefined beyond the name:

- Ingredient Types
- Ingredient Instances
- Actions
- Transformations
- Tools
- Containers
- Workstations
- Environment
- Particles
- Recipes
- Events

## 5. Knowledge Layers

The layer this doc's notes call out as the strongest idea. Natural language compiles *down* through three layers — never the reverse:

```
Grandma Layer   →   "pela la patata" ("peel the potato")
      ↓
World Layer     →   PEEL
                     requires: knife
                     creates: peeled potato, potato peel
      ↓
Scientific Layer →  skin removed, water decreases, surface changes, ...
```

Grandma-layer language is parsed into world-layer mechanics; the world layer's effects are explained (not derived) by the scientific layer. Inference never runs backward — you don't reconstruct grandma's phrasing from scientific state.

## 6. Ingredient Model

**TODO (from source):** flagged in the notes as "an enormous document" on its own — still needs to be written. The outline gives the fields it must cover:

- Identity
- Structure
- Composition
- Capabilities
- Possible States
- Allowed Transformations
- Produced Byproducts
- Sensory Properties
- Metadata

## 7. Actions

An action is knowledge, not code. Example shape, per the source:

```
PEEL
  requires:      knife
  valid targets: vegetables
  outputs:       peeled object, waste
  duration:      variable
  precision:     optional
```

## 8. States

Not just the coarse `raw` / `fried`. The source calls out a richer vocabulary:

`peeled`, `cut`, `broken`, `burned`, `crispy`, `cold`, `warm`, `hot`, `overcooked`, `salted`, `wet`, `dry`

## 9. Transformations

> "Recipes don't exist. Transformations exist."

Example:

```
egg → break → egg white + egg yolk + shell
```

(Consistent with the egg-separation example in `CLAUDE_DEV_CTX.md` and the PDF — conservation of mass/entities holds across all three source docs.)

## 10. Event System

Everything is Event Sourcing. State is never stored directly — only events:

`PICK_UP`, `DROP`, `CUT`, `MOVE`, `HEAT`, `WAIT`, `MIX`, ...

World state is a projection of the event log, not a thing that's saved.

## 11. Timeline

Because everything is event-sourced, these come "for free" from the same log:

- undo / redo
- save
- playback
- "ghost cooking" (replaying a past run)
- AI explanation (narrating what happened, from events)
- robot execution (replaying/driving the same events on a physical actuator)

## 12. Recipe Model

The key departure from the step-sequence model elsewhere in this repo. A recipe does **not** contain:

```
Step 1
Step 2
Step 3
```

It contains:

- Goals
- Constraints
- Required Ingredients
- Acceptable States
- Serving
- Optional Variants
- Tolerance
- Victory Conditions

i.e. a recipe declares *what counts as done*, not an ordered procedure to follow. (This is the piece that conflicts with `RecipeScriptSchema`'s linear `sequence: MechanicalAction[]` in `CLAUDE_DEV_CTX.md` — **resolved 2026-08-12, see `WORLD_MODEL.md`**: this section's shape — Goals/Constraints/Acceptable States/Tolerance/Victory Conditions — is the intent layer a not-yet-built planner would compile into one of `RecipeScriptSchema`'s linear sequences, not a competing format to pick instead of it.)

## 13. Validation Engine

> "Is this tortilla valid?"

Validation compares **states**, not text. A finished dish is checked against the recipe's declared acceptable states / victory conditions (§12), not against a transcript of steps taken to get there.

## 14. Human Language

Where the LLM sits in the pipeline:

```
"corta la cebolla finita" ("cut the onion thin")
      ↓
LLM
      ↓
Intent: SLICE, target: onion, thickness: thin
      ↓
Deterministic engine
```

The LLM's only job is producing a structured `Intent`; everything after that is deterministic engine logic.

## 15. Unknown Knowledge

Important, cross-referenced from §3. The world must accept an unknown ingredient, unknown action, or unknown state **without breaking**. (This is the same requirement as the PDF's "dynamic capability inference" — an unrecognized ingredient like passion fruit still needs inferred capabilities like `isPeelable`, `isChoppable`, `isFryable` at runtime rather than a hard failure.)

## 16. AI Integration

- The AI never cooks.
- The AI interprets.
- The AI never decides rules.

Same boundary as §14: LLM → Intent, never LLM → authoritative world state.

## 17. Robotics

> Same API.

```
Human → Timeline → Robot
```

Nothing about the model changes for a robotic actuator — it consumes/drives the same event timeline a human session would. (Narrower and more concrete than the PDF's separate "Unity physics engine for a robotic arm" framing — worth reconciling: is Unity the robot-side interpreter of this same timeline, or a distinct target?)

## 18. Multiplayer

Not a near-term goal (the project is currently single-player), but the architecture should be able to explain, without changing the fundamental model, how multiple agents could operate on the same timeline concurrently.

## 19. Future

Speculative, unscoped ideas from the notes — not commitments:

Smells, particles, fermentation, time, bacteria, economy, market, restaurants, robots.

## 20. Appendix

**TODO (from source) — not yet written:**

- JSON model
- Examples
- DSL
- Cooklang
- Comparison
- References

---

See `ENGINE_INVARIANTS.md` for the companion document: rules code generated against this concept must never violate.
````

## File: ENGINE_INVARIANTS.md
````markdown
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
11. **Autonomous execution defaults safe, not permissive.** CONCEPT.md §17: a robot drives the same event timeline as a human, same API — but "same API" must not mean "same default judgment call" on a food-safety shortfall a human would otherwise decide for themselves (e.g. accepting a runny egg yolk). Under `engine.ts`'s `SafetyPolicy.mode: "autonomous"`, a `CriticalControlPointSchema` shortfall that would only *warn* under human execution instead hard-rejects unless explicitly pre-authorized (`humanOverrides`). This invariant is scoped to that one mechanism — it does NOT mean the rest of the engine is robot-ready: every categorical "informational only" action parameter (heatLevel, doneness, oilAdditionRate, ...) is a human-readable technique hint with no defined mapping to an actual actuator command, and inventing one unilaterally would itself violate this invariant, not satisfy it. A future closed-loop control/perception layer is a separate, larger piece of work, not implied by this one.

## Provenance

Captured verbatim (translated where needed) from `masideas.md`'s closing proposal for this file, plus invariant 11 (added once the project's stated audience — CONCEPT.md §17 — made the gap between "warns" and "who's reading the warning" load-bearing rather than academic). Cross-references: invariant 10 formalizes `CONCEPT.md` §14/§16; invariant 11 formalizes `CONCEPT.md` §17 against the HACCP mechanism `ROADMAP.md` Phase 2/4 added; invariants 7–9 formalize `CONCEPT.md` §10 (event sourcing); invariant 1 is the open tension flagged in `CONCEPT.md` §12 and at the top of that file.
````

## File: tsconfig.json
````json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src", "scripts", "tests"]
}
````

## File: data/actions/crush.json
````json
{
  "id": "crush",
  "verb": "CRUSH",
  "names": {
    "en": "Crush",
    "es": "Majar"
  },
  "requiredTools": [
    "mortar"
  ],
  "requiredTargetCapability": "isCrushable",
  "validTargetKinds": [
    "ingredient"
  ],
  "requiredIngredientCapabilities": [],
  "parameters": [
    {
      "id": "fineness",
      "names": {
        "en": "Fineness",
        "es": "Finura"
      },
      "required": true,
      "allowedValues": [
        "coarse",
        "fine_paste",
        "cracked",
        "ground"
      ]
    }
  ],
  "outputs": {
    "transformedStateFromParameter": "fineness",
    "spawnsTargetByproducts": false
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "CUT-shaped (data/actions/cut.json): one verb with a 'fineness' parameter rather than two, since coarse-vs-paste is a difference of degree, not of kind. The generic mash/crush verb potato.json's metadata flagged as missing since the very first potato entity ('mash isn't wired up yet') — implemented here for garlic first, where it's load-bearing (see emulsify.json's statePrerequisite), not retrofitted onto potato speculatively. Mortar-specific, not mixer/blender-based — see mortar.json.",
    "finenessNote": "'cracked'/'ground' added 2026-08-13 for black_pepper.json (whole peppercorns crushed to cracked or ground, the real distinction behind 'freshly cracked black pepper' vs. table-ground — coarse/fine_paste don't fit a dry spice that never becomes a paste). Kept as ONE shared enum on the existing verb rather than a second fineness parameter or a new verb: garlic and pepper both answer the same real question ('how finely was this crushed'), just with different endpoint vocabulary for their respective materials — same reasoning CUT's single 'shape' enum already applies across every choppable entity in this repo, not just potato.",
    "retrySafeNote": "retrySafe: true — further crushing an already-crushed target is physically continuous (coarse -> fine_paste is a spectrum), not a discrete duplication risk."
  },
  "verification": {
    "method": "tactile_force",
    "description": "Resistance drops to near-zero and texture matches the requested fineness (coarse vs. fine_paste)",
    "confidence": "medium"
  },
  "hazards": [
    {
      "type": "impact_force",
      "severity": "low",
      "note": "Mortar and pestle — minor pinch/impact risk"
    }
  ],
  "retrySafe": true
}
````

## File: data/actions/cut.json
````json
{
  "id": "cut",
  "verb": "CUT",
  "names": {
    "en": "Cut",
    "es": "Cortar"
  },
  "requiredTools": [
    "knife"
  ],
  "requiredTargetCapability": "isChoppable",
  "validTargetKinds": [
    "ingredient"
  ],
  "parameters": [
    {
      "id": "shape",
      "names": {
        "en": "Shape",
        "es": "Forma"
      },
      "required": true,
      "allowedValues": [
        "sliced",
        "diced",
        "julienne",
        "chopped",
        "minced"
      ]
    }
  ],
  "outputs": {
    "transformedStateFromParameter": "shape",
    "spawnsTargetByproducts": false
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "CUT is one verb with a 'shape' parameter (CLAUDE_DEV_CTX.md's 4th pillar, Parameters), not five separate verbs — the resulting state is whatever shape was chosen, so allowedValues doubles as the set of post-cut states.",
    "retrySafeNote": "retrySafe: true — re-cutting already-cut pieces just re-asserts/changes the shape parameter, no duplication risk (no byproducts spawned)."
  },
  "verification": {
    "method": "visual",
    "description": "Pieces match the requested shape/size (sliced/diced/julienne/chopped/minced)",
    "confidence": "high"
  },
  "hazards": [
    {
      "type": "sharp_blade",
      "severity": "high",
      "note": "Repeated blade motion directly against the target — the closest sustained hand-to-blade proximity of any action in this vocabulary"
    }
  ],
  "retrySafe": true
}
````

## File: data/actions/emulsify.json
````json
{
  "id": "emulsify",
  "verb": "EMULSIFY",
  "names": {
    "en": "Emulsify",
    "es": "Montar"
  },
  "requiredTools": [
    "mortar"
  ],
  "requiredTargetCapability": "isEmulsifiable",
  "validTargetKinds": [
    "ingredient"
  ],
  "requiredIngredientCapabilities": [
    "isEmulsifier"
  ],
  "parameters": [
    {
      "id": "oilAdditionRate",
      "names": {
        "en": "Oil addition rate",
        "es": "Ritmo de incorporación del aceite"
      },
      "required": false,
      "allowedValues": [
        "drop_by_drop",
        "slow_stream",
        "poured_all_at_once"
      ]
    },
    {
      "id": "durationSeconds",
      "names": {
        "en": "Duration",
        "es": "Duración"
      },
      "required": false,
      "numericRange": {
        "unit": "seconds",
        "min": 60,
        "max": 1800
      }
    }
  ],
  "outputs": {
    "transformedState": "emulsified",
    "spawnsTargetByproducts": false
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "Requires the target already in state 'fine_paste' (see garlic.json's statePrerequisites.emulsify) — a coarse crush can't stabilize an emulsion. requiredIngredientCapabilities: isEmulsifier (oil.json) rather than reusing FRY's isFryingMedium — physically the same substance, but the culinary role here (dispersed-phase fat being sheared into an emulsion) is a different fact worth its own flag, matching this codebase's one-capability-per-verb convention.",
    "patienceNote": "oilAdditionRate/durationSeconds are informational only (like fry.json's heatLevel/agitation) — NOT state-determining; transformedState is fixed at 'emulsified' regardless of the value chosen. This is a real, deliberate honesty gap, not an oversight: a genuine simulation would have EMULSIFY fail into a 'broken' state when oil is added faster than the paste's alliaceous compounds can be sheared around each new oil droplet (classic emulsion-breaking — the dispersed phase coalesces instead of staying suspended once its addition rate outpaces mechanical shear), which is exactly why 'poured_all_at_once' is a real way to ruin a batch and 'drop_by_drop' is the traditional advice. This engine has no conditional-outcome mechanism (parameters only ever set a *fixed* declared state, per action.ts's ActionOutputsSchema) to branch the result on a parameter's value without turning the parameter into a disguised state-picker, which would be dishonest in the other direction (claiming a cook 'chose' failure). Recorded for provenance/technique documentation, not (yet) enforced — same category as fry.json's heatLevel not being physically simulated.",
    "eggComparisonNote": "Traditional allioli (garlic + oil only, this action) is notoriously harder to emulsify and hold than an egg-yolk-based version (a garlic mayonnaise, sometimes also called alioli outside Catalonia) — egg yolk's lecithin is a far more effective, forgiving emulsifier than garlic's own mucilage (see egg_yolk.json's aggregationState: 'emulsion' note). Now built as data/recipes/handmade-alioli-egg-yolk.json, a sibling of handmade-alioli.json sharing this exact action — same target (garlic-1, still requires 'fine_paste' first), same tools (mortar, knife), same requiredIngredientCapabilities (isEmulsifier/oil, unchanged), egg_yolk-1 added only as an extra available ingredient (see egg_yolk.json's isEmulsionStabilizer, informational only — same honesty limit as this note's own patienceNote). The two recipes differ only in oilAdditionRate/durationSeconds values and the presence of egg_yolk-1 — deliberately structured that way so the two are directly comparable step-by-step, not reimplemented from scratch.",
    "retrySafeNote": "retrySafe: true at the DATA/INVENTORY level only (no duplication, no engine error) — NOT a claim that repeating it is culinarily harmless. Re-running this on an already-finished result risks overcooking/over-working the actual dish, a real physical risk this schema-level flag can't and shouldn't paper over. Specifically: re-agitating an already-stable emulsion risks BREAKING it (see emulsify.json's patienceNote on how emulsions fail) — the opposite of harmless repetition."
  },
  "verification": {
    "method": "visual",
    "description": "Mixture thickened, glossy, and uniform — no visible pooled/separated oil",
    "confidence": "low"
  },
  "hazards": [
    {
      "type": "impact_force",
      "severity": "low",
      "note": "Mortar work, minimal"
    }
  ],
  "retrySafe": true
}
````

## File: data/actions/pasteurize.json
````json
{
  "id": "pasteurize",
  "verb": "PASTEURIZE",
  "names": {
    "en": "Pasteurize",
    "es": "Pasteurizar"
  },
  "requiredTools": [
    "pot"
  ],
  "requiredTargetCapability": "isPasteurizable",
  "validTargetKinds": [
    "ingredient"
  ],
  "requiredIngredientCapabilities": [],
  "parameters": [
    {
      "id": "waterTempC",
      "names": {
        "en": "Water bath temperature",
        "es": "Temperatura del baño de agua"
      },
      "required": true,
      "numericRange": {
        "unit": "celsius",
        "min": 55,
        "max": 63
      }
    },
    {
      "id": "durationSeconds",
      "names": {
        "en": "Duration",
        "es": "Duración"
      },
      "required": true,
      "numericRange": {
        "unit": "seconds",
        "min": 60,
        "max": 7200
      }
    }
  ],
  "outputs": {
    "addsTag": "pasteurized",
    "spawnsTargetByproducts": false
  },
  "duration": "variable",
  "precision": "required",
  "metadata": {
    "notes": "One shared action, TWO physically different processes depending on the target: in-shell (data/entities/egg.json, egg_pasteurization_raw.json — the whole egg submerged, shell slows heat penetration, needs much longer) or already-liquid (data/entities/egg_yolk.json, egg_pasteurization_liquid.json — separated yolk, no shell, reaches bath temperature quickly, needs far less time — see that CCP's thermalModel, real D/z-value kinetics, not a fixed guess). waterTempC/durationSeconds' ranges (55-63°C, 60-7200s) are the UNION of both processes' plausible values, not a recommendation to use the wide range freely — the actual required combination is computed per-CCP by engine.ts, not by this action's declared bounds. addsTag 'pasteurized', not a state change either way: the egg/yolk is still 'raw' afterward — that's the entire point, texture unchanged, risk reduced. Both parameters are 'required': true (unlike almost every other numeric parameter in this codebase) — a PASTEURIZE step with an unstated temperature/duration is meaningless; there is no sensible default to fall back to for a step whose only job is hitting a specific safety threshold.",
    "whyThisExists": "Built directly in response to a real, previously-unaddressed gap: data/recipes/handmade-alioli-egg-yolk.json used raw egg yolk that was NEVER heated anywhere in that recipe, so egg_cooking.json's CCP (checked only on FRY/SCRAMBLE/POACH/BOIL) never applied — the recipe had zero food-safety enforcement despite serving raw egg. This action + CCP is what that recipe now runs BEFORE separating the egg — see that recipe's own metadata for the full before/after.",
    "tagPropagationNote": "Relies on engine.ts's byproduct/combine tag-inheritance fix (added alongside this action) — without it, the 'pasteurized' tag added here would be silently dropped the moment SEPARATE spawns egg_yolk/egg_white, exactly defeating the purpose. See egg_yolk.json/egg_white.json's possibleTags for where it's allowed to land.",
    "retrySafeNote": "retrySafe: true — engine.ts guards addsTag against duplicates ('!instance.tags.includes(...)'), so re-running this after an interruption is a silent no-op, not a double effect. Unlike most cooking actions' culinary caveat, extending pasteurization time has no real downside (it stays raw either way) — one of the few actions where retry is unambiguously safe both at the data level AND culinarily."
  },
  "verification": {
    "method": "thermal",
    "description": "Water bath held continuously at the target waterTempC for the full durationSeconds, not a single spot reading",
    "confidence": "high"
  },
  "hazards": [
    {
      "type": "hot_liquid",
      "severity": "medium",
      "note": "Sustained warm water bath — lower scald risk than a rolling boil, but prolonged exposure"
    }
  ],
  "retrySafe": true
}
````

## File: data/actions/salt.json
````json
{
  "id": "salt",
  "verb": "SALT",
  "names": {
    "en": "Salt",
    "es": "Salar"
  },
  "requiredTools": [],
  "requiredTargetCapability": "isSeasonable",
  "validTargetKinds": [
    "ingredient"
  ],
  "requiredIngredientCapabilities": [
    "isSaltySeasoning"
  ],
  "parameters": [
    {
      "id": "timing",
      "names": {
        "en": "Timing relative to cooking",
        "es": "Momento respecto a la cocción"
      },
      "required": false,
      "allowedValues": [
        "before_cooking",
        "during_cooking",
        "after_cooking"
      ]
    }
  ],
  "outputs": {
    "addsTag": "salted",
    "spawnsTargetByproducts": false
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "Uses outputs.addsTag, not transformedState: a boiled potato that gets salted is still boiled, just also salted now — the two coexist, unlike boiled vs. fried which are mutually exclusive states. requiredIngredientCapabilities: isSaltySeasoning (renamed from the generic isSeasoning 2026-08-13, when pepper.json/chili.json were added as sibling seasoning verbs — see salt.json entity's capabilityNote for why generic isSeasoning would have silently accepted pepper/chili flakes as satisfying this check once they also declared it).",
    "timingNote": "Salting before vs. during vs. after cooking is NOT the same outcome chemically, and this parameter does not pretend it is: salting BEFORE a fry draws surface moisture out via osmosis ahead of time (less oil spatter, drier surface, faster/more even Maillard browning) but also gives salt time to diffuse into the flesh, not just sit on top; salting AFTER is purely a surface seasoning with zero effect on the cook itself; DURING sits somewhere between the two depending on when exactly. Added informational-only, same limits and same reasoning as fry.json's heatLevel/doneness/agitation (see that file's parameterNotes): outputs.addsTag stays a flat boolean-ish tag regardless of timing — there is no moisture/osmosis simulation here, and no distinct 'salted_before_cook' vs 'salted_after_cook' state. This records WHAT was asked for/done, for provenance and recipe-authoring clarity; it does not feed back into FRY's outcome (doneness, edgeStyle, verification) at all, even though in reality it should. A real fix would need FRY itself to read a moisture/salting-history signal — out of scope here, flagged rather than silently implied to already work.",
    "retrySafeNote": "retrySafe: true — engine.ts guards addsTag against duplicates ('!instance.tags.includes(...)'), so re-running this after an interruption is a silent no-op, not a double effect."
  },
  "verification": {
    "method": "manual_confirmation",
    "description": "No reliable sensor check for 'properly seasoned' in this vocabulary — taste isn't modeled at all",
    "confidence": "low"
  },
  "hazards": [],
  "retrySafe": true
}
````

## File: data/actions/scramble.json
````json
{
  "id": "scramble",
  "verb": "SCRAMBLE",
  "names": {
    "en": "Scramble",
    "es": "Revolver"
  },
  "requiredTools": [
    "pan"
  ],
  "requiredTargetCapability": "isScramblable",
  "validTargetKinds": [
    "ingredient"
  ],
  "requiredIngredientCapabilities": [
    "isFryingMedium"
  ],
  "parameters": [
    {
      "id": "heatLevel",
      "names": {
        "en": "Heat level",
        "es": "Nivel de fuego"
      },
      "required": false,
      "allowedValues": [
        "low",
        "medium",
        "high"
      ]
    },
    {
      "id": "durationSeconds",
      "names": {
        "en": "Duration",
        "es": "Duración"
      },
      "required": false,
      "numericRange": {
        "unit": "seconds",
        "min": 30,
        "max": 600
      }
    },
    {
      "id": "curdSize",
      "names": {
        "en": "Curd size",
        "es": "Tamaño del grumo"
      },
      "required": false,
      "allowedValues": [
        "small",
        "medium",
        "large"
      ]
    }
  ],
  "outputs": {
    "transformedState": "scrambled",
    "spawnsTargetByproducts": false
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "Distinct verb from FRY even though both need the same pan + frying-medium setup: stirred while cooking into curds, vs. FRY left undisturbed as a held sheet (the plain/French omelette reading of FRY on egg_cracked). Deliberately its own capability (isScramblable) rather than reusing isFryable, matching this codebase's one-capability-per-verb convention (isPeelable/PEEL, isBoilable/BOIL, ...) instead of overloading one flag across two verbs. Targets egg_cracked, not the whole raw egg — see data/actions/crack.json.",
    "parameterNotes": "durationSeconds' 30-600s range spans both styles well documented in professional technique: low heat + frequent folding over several minutes yields small, creamy curds (the French/Ramsay style — longer end of the range); higher heat + less frequent stirring sets larger curds faster (the diner-style American scramble — shorter end). curdSize records the intended outcome directly rather than trying to derive it from heatLevel+durationSeconds, since the real determinant (stir frequency) isn't itself modeled as a parameter. None of these are state-determining; see fry.json's parameterNotes for the same heatLevel caveat, and egg_cracked.json's criticalControlPointsByAction for durationSeconds' actual safety-threshold check.",
    "retrySafeNote": "retrySafe: true at the DATA/INVENTORY level only (no duplication, no engine error) — NOT a claim that repeating it is culinarily harmless. Re-running this on an already-finished result risks overcooking/over-working the actual dish, a real physical risk this schema-level flag can't and shouldn't paper over."
  },
  "verification": {
    "method": "visual",
    "description": "Curds formed matching the requested curdSize, no longer liquid",
    "confidence": "medium"
  },
  "hazards": [
    {
      "type": "hot_oil",
      "severity": "medium",
      "note": "Hot pan, active stirring close to the heat source"
    }
  ],
  "retrySafe": true
}
````

## File: data/entities/egg_white.json
````json
{
  "id": "egg_white",
  "kind": "ingredient",
  "names": {
    "en": "Egg white",
    "es": "Clara de huevo"
  },
  "aggregationState": "liquid",
  "structure": {
    "composite": false,
    "components": []
  },
  "composition": {
    "nutrientsPer100g": {
      "water_g": 88,
      "protein_g": 11,
      "carbohydrate_g": 0.7
    },
    "citation": {
      "source": "USDA FoodData Central (fdc.nal.usda.gov), raw egg white",
      "confidence": "standard_reference",
      "note": "Same caveat as egg.json/egg_yolk.json — not checked against the exact current FDC entry."
    }
  },
  "possibleStates": ["raw", "blended"],
  "possibleTags": ["pasteurized"],
  "allowedTransformations": ["mix"],
  "producedByproducts": [],
  "capabilities": {
    "isBlendable": true
  },
  "sensory": {
    "taste": ["neutral"],
    "texture": ["viscous", "translucent"],
    "color": "clear"
  },
  "cooklang": {
    "canonicalToken": "clara",
    "spiceLock": false
  },
  "metadata": {
    "producedBy": ["separate"],
    "notes": "Byproduct entity spawned when 'separate' is applied to egg.json (see EntitySchema.producedByproducts on egg) — mirrors potato_peel.json's producedBy convention for potato's 'peel' byproduct.",
    "todo": "isBlendable/mix reuses the existing MIX action (data/actions/mix.json, mixer tool) — same mechanism as potato_peel.json. MIX has no intensity/duration parameter yet, so 'mixed a little vs. a lot' isn't distinguishable, just raw-vs-blended; whipping to stiff peaks specifically (soft/firm/stiff peak stages) isn't modeled.",
    "pasteurizedTagNote": "possibleTags: ['pasteurized'] for the same reason as egg_yolk.json's — a raw meringue/royal icing use case would carry the same never-independently-cooked risk this whole mechanism exists for. See data/actions/pasteurize.json."
  }
}
````

## File: data/entities/potato_peel.json
````json
{
  "id": "potato_peel",
  "kind": "ingredient",
  "names": {
    "en": "Potato peel",
    "es": "Piel de patata"
  },
  "aggregationState": "solid",
  "structure": {
    "composite": false,
    "components": []
  },
  "possibleStates": ["raw", "fried", "blended"],
  "allowedTransformations": ["fry", "mix"],
  "producedByproducts": [],
  "capabilities": {
    "isFryable": true,
    "isBlendable": true
  },
  "sensory": {
    "texture": ["thin", "fibrous"],
    "color": "brown"
  },
  "metadata": {
    "isWaste": true,
    "reusable": true,
    "producedBy": ["peel"],
    "notes": "isWaste and reusable both hold: a byproduct stream with two reuse paths — fried into crisps, or blended in a mixer — rather than only ever discarded. Byproduct entity spawned when 'peel' is applied to potato.json (see EntitySchema.producedByproducts on potato)."
  }
}
````

## File: data/entities/tortilla_mixture.json
````json
{
  "id": "tortilla_mixture",
  "kind": "ingredient",
  "names": {
    "en": "Tortilla mixture",
    "es": "Mezcla de tortilla"
  },
  "aggregationState": "paste",
  "structure": {
    "composite": true,
    "components": ["potato", "egg"]
  },
  "possibleStates": ["raw", "fried"],
  "possibleTags": ["flipped", "salted"],
  "allowedTransformations": ["fry", "flip"],
  "producedByproducts": [],
  "criticalControlPointsByAction": {
    "fry": "egg_cooking"
  },
  "capabilities": {
    "isFryable": true,
    "isFlippable": true
  },
  "sensory": {
    "taste": ["neutral"],
    "texture": ["thick"],
    "color": "pale yellow"
  },
  "cooklang": {
    "canonicalToken": "tortilla",
    "spiceLock": false
  },
  "metadata": {
    "producedBy": ["combine"],
    "notes": "The first entity in this repo to actually populate structure.composite/components (potato + egg) — that field existed, unused, since ingredient.ts's first draft; see data/actions/combine.json. Result of COMBINE-ing a fried-potato instance with a beaten-egg instance (see data/actions/combine.json's requiredTargetCapability/requiredSecondaryCapability). possibleTags 'flipped' rather than a state: flipping doesn't change WHAT the mixture is (still 'fried' — it's mid-cook, on its second side), matching SALT's addsTag precedent, not a new transformedState.",
    "knownGap": "FRY applied twice (once before FLIP, once after) both times just sets the fixed state 'fried' — this schema has no way to distinguish 'one side fried' from 'both sides fried, fully cooked', since ActionOutputsSchema.transformedState is always a fixed target regardless of the instance's current state. Left honest rather than invented new states ('fried_one_side'/'fried_both_sides') that FRY's shared, fixed-output shape can't actually support without breaking every other FRY user — same category of limitation as fry.json's doneness parameter.",
    "haccpGapFound2026-08-12": "criticalControlPointsByAction was MISSING entirely until asked whether tortilla de Betanzos — a real regional style defined by an intentionally liquid, barely-set interior — was makeable. Same class of bug as handmade-alioli-egg-yolk.json's original zero-enforcement gap: this entity is built from egg (COMBINE's secondary instance) and FRIED for a duration a real recipe could set arbitrarily short, with no safety check at all until this fix. Reuses egg_cooking.json (same organism, same risk, same reasoning egg_cracked.json already uses for FRY/SCRAMBLE) rather than inventing a new CCP — the risk is a fact about egg being present in the mixture, not about which composite entity it ended up in."
  }
}
````

## File: data/entities/water.json
````json
{
  "id": "water",
  "kind": "ingredient",
  "names": {
    "en": "Water",
    "es": "Agua"
  },
  "aggregationState": "liquid",
  "structure": {
    "composite": false,
    "components": []
  },
  "possibleStates": ["cold", "boiling"],
  "allowedTransformations": [],
  "producedByproducts": [],
  "capabilities": {
    "isBoilingMedium": true
  },
  "thermophysical": {
    "densityKgPerM3": 1000,
    "boilingPointC": 100,
    "specificHeatJPerKgK": 4186,
    "citation": {
      "source": "Standard physical constants for water at 1 atm (sea-level standard atmospheric pressure) — CRC Handbook of Chemistry and Physics",
      "confidence": "standard_reference",
      "note": "boilingPointC: 100 is pressure-dependent, not a universal constant — real water boils below 100°C at altitude (e.g. ~95°C around 1900m/6200ft, ~93°C in Denver). This repo has no altitude/pressure parameter anywhere — every BOIL/POACH duration and every CCP threshold implicitly assumes sea-level pressure. A robot operating at meaningful altitude would need this accounted for; flagged as a real, unaddressed gap, not silently assumed away. specificHeatJPerKgK: 4186 (4.186 J/(g·K)) added 2026-08-13 as the input src/heat-source.ts's estimatedPreheatSeconds needs — a real, essentially constant value across normal cooking temperatures, not a food-composition average like potato.json's/garlic.json's figures."
    }
  },
  "sensory": {
    "taste": ["neutral"],
    "texture": ["liquid"]
  },
  "cooklang": {
    "canonicalToken": "agua",
    "spiceLock": false
  },
  "metadata": {
    "notes": "isBoilingMedium makes water satisfy BOIL's requiredIngredientCapabilities (data/actions/boil.json), the same pattern as oil.json/isFryingMedium for FRY."
  }
}
````

## File: data/recipes/handmade-alioli.json
````json
{
  "id": "handmade_alioli",
  "names": {
    "en": "Handmade Alioli",
    "es": "Alioli Casero"
  },
  "initialInventory": [
    { "id": "garlic-1", "entityId": "garlic", "state": "raw", "tags": [] },
    { "id": "oil-1", "entityId": "oil", "state": "cold", "tags": [] },
    {
      "id": "salt-1",
      "entityId": "salt",
      "state": "dry",
      "tags": [],
      "quantity": {
        "kind": "imprecise",
        "descriptor": "pinch",
        "approxRangeGrams": { "min": 0.3, "max": 0.6 },
        "citation": {
          "source": "Commonly cited culinary conversion: 1 pinch \u2248 1/16 tsp of fine table salt",
          "confidence": "commonly_cited_unverified",
          "note": "Genuinely imprecise by convention, not just uncited \u2014 cooks don't measure a pinch. Also varies by crystal size (fine vs. coarse), which this repo doesn't model as a separate entity yet \u2014 see QuantitySchema's doc comment (ingredient.ts)."
        }
      }
    }
  ],
  "availableTools": ["knife", "mortar"],
  "sequence": [
    { "actionId": "peel", "targetInstanceId": "garlic-1", "params": {}, "availableIngredientInstanceIds": [] },
    { "actionId": "salt", "targetInstanceId": "garlic-1", "params": {}, "availableIngredientInstanceIds": ["salt-1"] },
    { "actionId": "crush", "targetInstanceId": "garlic-1", "params": { "fineness": "fine_paste" }, "availableIngredientInstanceIds": [] },
    {
      "actionId": "emulsify",
      "targetInstanceId": "garlic-1",
      "params": { "oilAdditionRate": "drop_by_drop", "durationSeconds": "900" },
      "availableIngredientInstanceIds": ["oil-1"]
    }
  ],
  "metadata": {
    "notes": "No egg, no mixer — a knife is only for PEEL (peeling isn't mortar work), everything else works garlic-1 entirely in the mortar, matching the traditional Catalan technique. SALT before CRUSH, not after: salt is traditionally added early and pounded in with the garlic itself (helping break it down, per real technique), not sprinkled on at the end the way salted-fried-potatoes.json salts a finished potato — a genuine sequencing difference between the two recipes, not an arbitrary one. oilAdditionRate: 'drop_by_drop' and durationSeconds: 900 (15 minutes) are the 'patience' the request asked for made concrete and slow on purpose — see emulsify.json's patienceNote for exactly what this does and doesn't enforce. The finished garlic-1 ends in state 'emulsified', tag 'salted' — this recipe's `names` field is what carries 'alioli' as a concept, the same way salted-fried-potatoes.json names a potato-in-a-particular-state 'Salted Fried Potatoes' rather than spawning a separate dish entity; see emulsify.json's eggComparisonNote for why a real distinct composite 'alioli' entity was deliberately not modeled yet.",
    "comparisonGroup": "handmade_alioli_egg_yolk (data/recipes/handmade-alioli-egg-yolk.json) is this recipe's sibling — same tools, same peel/salt/crush/emulsify action sequence, differing only in oilAdditionRate/durationSeconds and the presence of an egg_yolk-1 ingredient, specifically so the two can be compared step-by-step rather than read as two unrelated files. RecipeScriptSchema (recipe.ts) has no formal 'variant of' field — this is a documentation-only cross-reference, not a schema-enforced relationship."
  }
}
````

## File: scripts/attempt-tortilla.ts
````typescript
import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Originally an empirical capability test (2026-08-12) that PROVED, by
 * trying and failing, that the vocabulary couldn't make a tortilla de
 * patatas: two real components (fried potato, beaten egg) were makeable,
 * but nothing combined two instances into one, and no FLIP verb existed.
 * See ROADMAP.md's capability-test table and LEARNINGS.md's 2026-08-12
 * entry for the original findings.
 *
 * Both gaps are now closed (data/actions/combine.json, data/actions/
 * flip.json, data/entities/tortilla_mixture.json) — this script is kept,
 * updated, as a standing regression check that they STAY closed, rather
 * than deleted or left claiming "BLOCKED" after the fact (which would be
 * exactly the stale-docs failure mode CLAUDE.md warns against). The
 * canonical, full recipe is data/recipes/tortilla-de-patatas.json — run it
 * with `npm run recipe -- tortilla_de_patatas`. This script is the narrower
 * "does the vocabulary itself still support it" check.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const tools = new Set(["knife", "pan", "bowl"]);
const ingredients = new Set(["oil", "salt"]);

function apply(instance: Instance, actionId: string, params?: Record<string, string>) {
  const action = actions.get(actionId)!;
  const result = applyAction(instance, action, entities, tools, params, ingredients, ccps);
  console.log(`  ${action.verb}: "${instance.state}" -> "${result.instance.state}"`);
  for (const warning of result.warnings) console.log(`  WARNING: ${warning.slice(0, 100)}...`);
  return result;
}

console.log("--- Potato component ---");
let potato: Instance = { entityId: "potato", state: "raw", tags: [] };
potato = apply(potato, "peel").instance;
potato = apply(potato, "cut", { shape: "sliced" }).instance;
potato = apply(potato, "fry", { heatLevel: "low", durationSeconds: "900" }).instance;
console.log(`  Potato component done: "${potato.state}" (soft-fried, unbrowned)`);

console.log("\n--- Egg component ---");
const crackResult = applyAction({ entityId: "egg", state: "raw", tags: [] }, actions.get("crack")!, entities, tools, {}, ingredients);
let egg = crackResult.spawned.find((s) => s.entityId === "egg_cracked")!;
console.log(`  CRACK: spawned egg_cracked ("${egg.state}")`);
egg = apply(egg, "beat", { intensity: "beaten" }).instance;
egg = apply(egg, "salt").instance;
console.log(`  Egg component done: "${egg.state}", tags [${egg.tags}]`);

console.log("\n--- Combine: potato (target) + egg (secondary) -> tortilla_mixture ---");
const combineAction = actions.get("combine")!;
const combineResult = applyAction(potato, combineAction, entities, tools, {}, new Set(), new Map(), undefined, egg);
if (!combineResult.destroyed || !combineResult.secondaryDestroyed) {
  throw new Error("Expected COMBINE to consume BOTH the potato and the egg instance");
}
let tortilla = combineResult.spawned.find((s) => s.entityId === "tortilla_mixture")!;
if (!tortilla) throw new Error("Expected COMBINE to spawn tortilla_mixture");
console.log(`  Both potato and egg instances consumed. Spawned tortilla_mixture ("${tortilla.state}").`);

console.log("\n--- Fry, flip, fry again ---");
tortilla = apply(tortilla, "fry", { heatLevel: "medium", durationSeconds: "180" }).instance;
tortilla = apply(tortilla, "flip").instance;
tortilla = apply(tortilla, "fry", { heatLevel: "medium", durationSeconds: "120" }).instance;

console.log("\n=== VERDICT ===");
console.log(`Tortilla de patatas: state "${tortilla.state}", tags [${tortilla.tags}]. Fully makeable end-to-end.`);
console.log("Original blockers (no multi-instance merge, no FLIP) are closed. Not closed by this change:");
console.log("real robot control/perception for heatLevel/doneness/etc. — see ENGINE_INVARIANTS.md #11.");
````

## File: scripts/cut-potato.ts
````typescript
import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const availableTools = new Set(["knife"]);

interface Step {
  id: string;
  params?: Record<string, string>;
}

function run(steps: Step[]): Instance {
  let potato: Instance = { entityId: "potato", state: "raw", tags: [] };
  for (const step of steps) {
    const action = actions.get(step.id);
    if (!action) throw new Error(`Unknown action "${step.id}"`);
    const label = step.params
      ? ` (${Object.entries(step.params).map(([k, v]) => `${k}: ${v}`).join(", ")})`
      : "";
    console.log(`Applying ${action.verb}${label} to potato (state: "${potato.state}")`);
    potato = applyAction(potato, action, entities, availableTools, step.params).instance;
    console.log(`  -> potato is now "${potato.state}"`);
  }
  return potato;
}

console.log('Recipe says "cut the potatoes" — trying it straight from washed, unpeeled:');
try {
  run([{ id: "wash" }, { id: "cut", params: { shape: "diced" } }]);
} catch (err) {
  console.log(`  REJECTED: ${(err as Error).message}`);
}

console.log("\nCorrect order, diced:");
run([{ id: "wash" }, { id: "peel" }, { id: "cut", params: { shape: "diced" } }]);

console.log("\nCorrect order, julienne:");
run([{ id: "wash" }, { id: "peel" }, { id: "cut", params: { shape: "julienne" } }]);

console.log("\nCUT with no shape given:");
try {
  run([{ id: "wash" }, { id: "peel" }, { id: "cut" }]);
} catch (err) {
  console.log(`  REJECTED: ${(err as Error).message}`);
}

console.log("\nCUT with an invalid shape:");
try {
  run([{ id: "wash" }, { id: "peel" }, { id: "cut", params: { shape: "shredded" } }]);
} catch (err) {
  console.log(`  REJECTED: ${(err as Error).message}`);
}
````

## File: scripts/reuse-potato-peel.ts
````typescript
import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance, type ExecutionResult } from "../src/engine.ts";

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const availableTools = new Set(["knife", "pan"]);

function apply(
  instance: Instance,
  actionId: string,
  params?: Record<string, string>,
  availableIngredients?: ReadonlySet<string>
): ExecutionResult {
  const action = actions.get(actionId);
  if (!action) throw new Error(`Unknown action "${actionId}"`);
  const label = params
    ? ` (${Object.entries(params).map(([k, v]) => `${k}: ${v}`).join(", ")})`
    : "";
  console.log(`Applying ${action.verb}${label} to ${instance.entityId} (state: "${instance.state}")`);
  const result = applyAction(instance, action, entities, availableTools, params, availableIngredients);
  console.log(`  -> ${instance.entityId} is now "${result.instance.state}"`);
  for (const s of result.spawned) console.log(`  -> spawned ${s.entityId} (state: "${s.state}")`);
  return result;
}

let potato: Instance = { entityId: "potato", state: "raw", tags: [] };
({ instance: potato } = apply(potato, "wash"));

const peelResult = apply(potato, "peel");
potato = peelResult.instance;
const peel = peelResult.spawned.find((s) => s.entityId === "potato_peel");
if (!peel) throw new Error("Expected 'peel' to spawn a potato_peel byproduct");

({ instance: potato } = apply(potato, "cut", { shape: "diced" }));

console.log("\nThe spawned potato_peel isn't discarded — it's a full instance and can take its own actions.");

console.log("\nTrying to fry it with no oil on hand:");
try {
  apply(peel, "fry");
} catch (err) {
  console.log(`  REJECTED: ${(err as Error).message}`);
}

console.log("\nWith oil available:");
const friedPeel = apply(peel, "fry", undefined, new Set(["oil"])).instance;

console.log("\nFinal inventory:");
console.log(`  potato: ${potato.state}`);
console.log(`  potato_peel: ${friedPeel.state}`);
````

## File: src/recipe.ts
````typescript
import { z } from "zod";
import { QuantitySchema } from "./ingredient.ts";

/**
 * RecipeScriptSchema — Roadmap Phase 3, the compiled recipe container:
 * initial inventory (instances that exist before the recipe starts) plus a
 * linear sequence of steps to run against engine.ts's applyAction.
 *
 * This commits to the linear step-sequence track from CLAUDE_DEV_CTX.md
 * (matching its reference OcrValidationEngine, which walks recipe.sequence
 * in order) rather than CONCEPT.md §12's goal-based/event-sourced track —
 * that fork is still unreconciled (see the note at the top of CONCEPT.md).
 * Every piece of engine work so far (engine.ts's applyAction) has been
 * built toward this side, so this file continues it rather than picking
 * the fork back up unprompted.
 */

/** One instance present before the recipe starts, keyed by a recipe-local id (not the entity id — a recipe could use two potatoes). */
export const RecipeInstanceSchema = z.object({
  id: z.string().min(1),
  entityId: z.string().min(1),
  state: z.string(),
  tags: z.array(z.string()).default([]),
  /** How much of this instance is present — see QuantitySchema's doc
   *  comment (ingredient.ts) for why this is a 3-kind union, not one
   *  number. Optional: a recipe can still name an instance ("salt-1
   *  exists") without committing to an amount, same as before this field
   *  existed — every recipe authored before 2026-08-13 is unaffected. */
  quantity: QuantitySchema.optional(),
});
export type RecipeInstance = z.infer<typeof RecipeInstanceSchema>;

export const RecipeStepSchema = z.object({
  actionId: z.string().min(1),
  /** Recipe-local instance id this step targets — either from initialInventory, or an id spawned by an earlier step. */
  targetInstanceId: z.string().min(1),
  params: z.record(z.string(), z.string()).default({}),
  /** Recipe-local instance ids of secondary ingredients (oil, water, salt, ...) available for this step's requiredIngredientCapabilities check. */
  availableIngredientInstanceIds: z.array(z.string()).default([]),
  /**
   * Recipe-local instance id of the SECOND instance a COMBINE-shaped action
   * consumes (engine.ts's `secondaryInstance` / `requiredSecondaryCapability`)
   * — e.g. the beaten-egg instance id when this step's action is COMBINE and
   * targetInstanceId is the fried-potato instance. Unlike
   * availableIngredientInstanceIds (checked for presence only, never
   * consumed), this instance is destroyed by the step, same as the primary
   * target. Unset for every action that isn't COMBINE-shaped.
   */
  secondaryInstanceId: z.string().optional(),
});
export type RecipeStep = z.infer<typeof RecipeStepSchema>;

export const RecipeScriptSchema = z.object({
  id: z.string().min(1),
  names: z.record(z.string(), z.string()).refine((n) => "en" in n, {
    message: "names must at least include an 'en' entry",
  }),
  initialInventory: z.array(RecipeInstanceSchema).min(1),
  /** Tool entity ids available throughout the whole recipe (not per-step — a kitchen's tools don't come and go per step). */
  availableTools: z.array(z.string()).default([]),
  sequence: z.array(RecipeStepSchema).min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type RecipeScript = z.infer<typeof RecipeScriptSchema>;
````

## File: data/actions/boil.json
````json
{
  "id": "boil",
  "verb": "BOIL",
  "names": {
    "en": "Boil",
    "es": "Hervir"
  },
  "requiredTools": [
    "pot"
  ],
  "requiredTargetCapability": "isBoilable",
  "validTargetKinds": [
    "ingredient"
  ],
  "requiredIngredientCapabilities": [
    "isBoilingMedium"
  ],
  "parameters": [
    {
      "id": "durationSeconds",
      "names": {
        "en": "Duration",
        "es": "Duración"
      },
      "required": false,
      "numericRange": {
        "unit": "seconds",
        "min": 60,
        "max": 2400
      }
    },
    {
      "id": "yolkDoneness",
      "names": {
        "en": "Yolk doneness",
        "es": "Punto de la yema"
      },
      "required": false,
      "allowedValues": [
        "soft",
        "medium",
        "hard"
      ]
    },
    {
      "id": "startMethod",
      "names": {
        "en": "Start method",
        "es": "Método de inicio"
      },
      "required": false,
      "allowedValues": [
        "cold_start",
        "boiling_start"
      ]
    },
    {
      "id": "heatSource",
      "names": {
        "en": "Heat source",
        "es": "Fuente de calor"
      },
      "required": false,
      "allowedValues": [
        "gas",
        "vitro",
        "wood"
      ]
    }
  ],
  "outputs": {
    "transformedState": "boiled",
    "spawnsTargetByproducts": false
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "Cooked in water — same 'cooking' family as FRY/BAKE but a genuinely different verb: different tool (pot vs pan vs oven), different medium (water vs oil vs none), different resulting state (boiled vs fried vs baked).",
    "belatedParityFix": "BOIL had NO parameters at all until this fix — not even durationSeconds — despite egg.json's criticalControlPointsByAction.boil already referencing egg_cooking.json's CCP for it. That CCP check still worked (engine.ts reads params['durationSeconds'] regardless of whether the action formally declares it), but without a declared numericRange, BOIL never got the sane-bounds/NaN validation FRY/POACH/PASTEURIZE get from the parameters[] loop — it was relying entirely on the direct Number.isNaN guard added to the CCP check itself specifically because relying on a parameter declaration elsewhere in the function was recognized as fragile. This is the concrete case that fragility was about, found by actually looking for it, not hypothetically.",
    "yolkDonenessNote": "Deliberately different allowedValues from fry.json/poach.json's yolkDoneness ('runny'/'medium'/'well_done') — a boiled egg is conventionally ordered as 'soft-boiled'/'medium-boiled'/'hard-boiled' in real usage, not 'runny'/'well-done'; matching the vocabulary people actually use per cooking method is more honest than forcing one shared enum across all three actions for uniformity's sake. Still informational only in the strict sense that engine.ts's applyAction does not read it to compute durationSeconds — but as of 2026-08-13, 'what does medium actually mean in seconds' now has a real, cited answer: src/egg-doneness.ts's EGG_BOIL_DONENESS table, closing the 'a robot needs to actually understand \"medium boiled\"' gap at the reference-data layer (CONCEPT.md §14's intent-resolution layer is still what would DO the resolving; this is what it resolves against). See shock.json for the other half of what actually determines a boiled egg's final doneness — durationSeconds alone is not the whole story.",
    "startMethodNote": "cold_start (egg placed in cold water, heated together) vs. boiling_start (egg lowered into already-boiling water) are genuinely different real techniques, not just a timing offset — cold_start eggs cook gradually through the whole temperature ramp, which is gentler (less prone to cracking from thermal shock) but means total time depends on how fast the water heats, i.e. on heatSource below, and src/egg-doneness.ts's EGG_BOIL_DONENESS table explicitly does NOT cover cold_start (see that file's own doc comment for why the two don't just add). boiling_start is what EGG_BOIL_DONENESS and this action's own verification criterion assume.",
    "heatSourceNote": "Purely informational, like heatLevel elsewhere in this vocabulary — recorded for provenance, not read by applyAction. See src/heat-source.ts's HeatSourceProfileSchema (data/heat-sources/*.json: gas, vitro, wood) for what actually differs by heat source: TIME to reach a boil from cold (estimatedPreheatSeconds) and how precisely a simmer can be held — explicitly NOT the boiling temperature itself, which stays ~100°C at sea level regardless (see that file's own doc comment for why conflating the two would be a real physics error, not just an oversimplification). A real, still-open gap: requiredTools above can't express 'exactly one of gas/vitro/wood is required' (AND-only semantics) — this parameter records which was used without the engine actually requiring one to be present.",
    "retrySafeNote": "retrySafe: true (data-level, no duplication) — but see shock.json's carryoverCookingNote: re-boiling something already at the desired doneness will overcook it, a real physical risk, not a data-model one."
  },
  "verification": {
    "method": "thermal",
    "description": "Water at or near 100°C (a visible rolling boil) maintained for at least durationSeconds",
    "confidence": "high"
  },
  "hazards": [
    {
      "type": "hot_liquid",
      "severity": "high",
      "note": "Boiling water and rising steam — splash/scald risk"
    }
  ],
  "retrySafe": true
}
````

## File: data/actions/poach.json
````json
{
  "id": "poach",
  "verb": "POACH",
  "names": {
    "en": "Poach",
    "es": "Escalfar"
  },
  "requiredTools": [
    "pan"
  ],
  "requiredTargetCapability": "isPoachable",
  "validTargetKinds": [
    "ingredient"
  ],
  "requiredIngredientCapabilities": [
    "isBoilingMedium"
  ],
  "parameters": [
    {
      "id": "waterTempC",
      "names": {
        "en": "Water temperature",
        "es": "Temperatura del agua"
      },
      "required": false,
      "numericRange": {
        "unit": "celsius",
        "min": 70,
        "max": 100
      }
    },
    {
      "id": "durationSeconds",
      "names": {
        "en": "Duration",
        "es": "Duración"
      },
      "required": false,
      "numericRange": {
        "unit": "seconds",
        "min": 60,
        "max": 600
      }
    },
    {
      "id": "yolkDoneness",
      "names": {
        "en": "Yolk doneness",
        "es": "Punto de la yema"
      },
      "required": false,
      "allowedValues": [
        "runny",
        "medium",
        "well_done"
      ]
    }
  ],
  "outputs": {
    "transformedState": "poached",
    "spawnsTargetByproducts": false
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "Cracked straight into barely-simmering water in a pan — the shallow-water technique (huevo escalfado), distinct from BOIL (data/actions/boil.json) which is the whole egg simmered in-shell in a pot. requiredTools is 'pan', not 'pot': poaching is standardly done in a wide shallow pan, unlike in-shell boiling. Like FRY, doesn't explicitly model shell removal (spawnsTargetByproducts: false) — same simplification FRY already makes for a raw whole egg cooked directly, kept for consistency rather than singling POACH out for more rigor.",
    "parameterNotes": "waterTempC's 70-100°C range deliberately excludes a full rolling boil as the intended target (100°C is the max only because water can't physically exceed it at sea-level pressure, not because it's recommended) — standard technique keeps poaching water at a bare simmer, ~85-95°C: a rolling boil's turbulence tears the white apart and can shatter the yolk. None of the parameters are state-determining. See egg.json's criticalControlPointsByAction for durationSeconds' actual safety-threshold check.",
    "yolkDonenessNote": "A poached egg is arguably ordered by yolk doneness even more consistently than a fried one — 'poached egg' alone usually implies runny by default in most kitchens. Same parameter, same allowedValues, same non-enforcement caveat as fry.json's yolkDonenessNote — added here rather than invented separately so the two actions stay directly comparable for this axis.",
    "retrySafeNote": "retrySafe: true at the DATA/INVENTORY level only (no duplication, no engine error) — NOT a claim that repeating it is culinarily harmless. Re-running this on an already-finished result risks overcooking/over-working the actual dish, a real physical risk this schema-level flag can't and shouldn't paper over."
  },
  "verification": {
    "method": "visual",
    "description": "White fully set and opaque; yolk set per yolkDoneness",
    "confidence": "medium"
  },
  "hazards": [
    {
      "type": "hot_liquid",
      "severity": "high",
      "note": "Simmering water — splash/scald risk"
    }
  ],
  "retrySafe": true
}
````

## File: data/entities/garlic.json
````json
{
  "id": "garlic",
  "kind": "ingredient",
  "names": {
    "en": "Garlic",
    "es": "Ajo"
  },
  "aggregationState": "solid",
  "structure": {
    "composite": false,
    "components": []
  },
  "composition": {
    "nutrientsPer100g": {
      "water_g": 59,
      "carbohydrate_g": 33,
      "protein_g": 6.4
    },
    "citation": {
      "source": "USDA FoodData Central (fdc.nal.usda.gov), raw garlic",
      "confidence": "standard_reference",
      "note": "Same caveat as potato.json/egg.json — not checked against the exact current FDC entry; garlic composition also varies meaningfully by cultivar and curing/storage time."
    }
  },
  "possibleStates": ["raw", "peeled", "sliced", "diced", "julienne", "chopped", "minced", "boiled", "fried", "baked", "coarse", "fine_paste", "emulsified"],
  "possibleTags": ["salted"],
  "allowedTransformations": ["peel", "cut", "boil", "fry", "bake", "salt", "crush", "emulsify"],
  "statePrerequisites": {
    "cut": "peeled",
    "crush": "peeled",
    "emulsify": "fine_paste"
  },
  "producedByproducts": ["garlic_peel"],
  "capabilities": {
    "isPeelable": true,
    "isChoppable": true,
    "isBoilable": true,
    "isFryable": true,
    "isBakeable": true,
    "isSeasonable": true,
    "isWashable": false,
    "isCrushable": true,
    "isEmulsifiable": true,
    "isAromaticSource": true
  },
  "thermophysical": {
    "densityKgPerM3": 1080,
    "thermalConductivityWPerMK": 0.52,
    "citation": {
      "source": "Choi & Okos (1986) predictive food-thermal-property model — see potato.json's identical citation",
      "confidence": "standard_reference",
      "note": "Recalled as typical clove-tissue values, not re-derived from the model against garlic's actual composition in this session."
    }
  },
  "sensory": {
    "taste": ["umami", "pungent"],
    "texture": ["firm"],
    "color": "off-white"
  },
  "cooklang": {
    "canonicalToken": "ajo",
    "spiceLock": false
  },
  "metadata": {
    "notes": "isWashable: false (explicit, not just omitted) unlike potato.json: garlic is dry-peeled, not washed — the papery skin comes off, it isn't scrubbed. statePrerequisites.cut mirrors potato.json/egg.json's same peel-before-cut pattern. thermophysical values are typical literature approximations for clove tissue, not measured (same caveat as potato.json/egg.json). possibleTags/salt: seasoning is orthogonal to shape/cook-state, same reasoning as potato.json. isAromaticSource is the ingredient-side capability satisfying data/actions/infuse.json's requiredIngredientCapabilities (garlic-infused oil) — the target there is oil.json, not garlic, since it's the oil whose property changes.",
    "flavorChemistryNote": "Source: Eric Block, \"Garlic and Other Alliums: The Lore and the Science\" (Royal Society of Chemistry, 2010) — the standard reference on Allium organosulfur chemistry; also accessibly covered in Harold McGee's \"On Food and Cooking\" — this repo has not re-verified the claim against either text directly in this session, recalled with reasonable confidence as well-established biochemistry, not a novel or uncertain claim. Garlic's characteristic pungency (allicin) doesn't exist in the intact clove — alliinase enzyme only converts alliin to allicin once cell walls rupture, i.e. when CUT or CRUSH actually happens. Chopped/minced/crushed garlic is measurably more pungent than sliced for exactly this reason (more ruptured cells per gram — a mortar-crushed fine_paste ruptures far more than a knife ever does), and taste onset is delayed a few seconds after cutting as the reaction proceeds. Not modeled here — neither CUT's 'shape' nor CRUSH's 'fineness' parameter affects flavor intensity in this schema yet — but worth citing since it's the clearest concrete example in this vocabulary so far of a mechanical action being a real chemical transition boundary (CLAUDE_DEV_CTX.md pillar 3), not just a shape change. It's also *why* a mortar-crushed fine_paste is what EMULSIFY requires (see statePrerequisites.emulsify) rather than just knife-minced garlic: maximizing rupture is exactly what makes the paste's alliaceous compounds available to help stabilize the emulsion at all. sensory.taste: 'pungent' added to SensoryPropertiesSchema's taste enum 2026-08-13 specifically because this note flagged the gap — allicin's sharpness is a trigeminal/chemesthetic sensation (like capsaicin in chili, piperine in black pepper), not one of the five basic tastes; 'umami' alone was the closest available value, not the correct one. Kept 'umami' alongside it here since cooked garlic genuinely does carry real savory depth too — both apply, not a replacement of one for the other."
  }
}
````

## File: data/entities/oil.json
````json
{
  "id": "oil",
  "kind": "ingredient",
  "names": {
    "en": "Oil",
    "es": "Aceite"
  },
  "aggregationState": "liquid",
  "structure": {
    "composite": false,
    "components": []
  },
  "possibleStates": ["cold", "hot"],
  "possibleTags": ["garlic_infused"],
  "allowedTransformations": ["infuse"],
  "producedByproducts": [],
  "capabilities": {
    "isFryingMedium": true,
    "isEmulsifier": true,
    "isInfusable": true
  },
  "thermophysical": {
    "densityKgPerM3": 920,
    "citation": {
      "source": "International Olive Council (IOC) trade standard density range for olive oil (approximately 0.910-0.916 g/cm³ at 20°C) — every recipe in this repo that names an oil is Spanish/Mediterranean and implicitly olive oil, not a generic vegetable oil",
      "confidence": "commonly_cited_unverified",
      "note": "This repo has not looked up the current IOC trade standard document to confirm the exact published range/temperature basis — 920 is a round, plausible value within the commonly-cited range, not read off the primary standard directly."
    }
  },
  "sensory": {
    "taste": ["neutral"],
    "texture": ["liquid"],
    "color": "yellow"
  },
  "cooklang": {
    "canonicalToken": "aceite",
    "spiceLock": false
  },
  "metadata": {
    "notes": "isFryingMedium makes oil satisfy FRY's requiredIngredientCapabilities (data/actions/fry.json) — 'used for cooking, frying' starts with frying specifically; a broader isCookingMedium/general-cooking capability can be added once a generic COOK verb exists. isEmulsifier makes oil satisfy EMULSIFY's requiredIngredientCapabilities (data/actions/emulsify.json, e.g. handmade alioli) — kept as its own flag rather than reusing isFryingMedium: physically the same fat, but a distinct culinary role (dispersed phase in an emulsion vs. a hot cooking medium), matching this codebase's one-capability-per-verb convention. isInfusable is the TARGET-side capability for data/actions/infuse.json — oil is what INFUSE acts on (it's the oil that 'becomes garlic-flavored'), unlike FRY/EMULSIFY where oil is the secondary ingredient satisfying someone else's requiredIngredientCapabilities."
  }
}
````

## File: data/entities/salt.json
````json
{
  "id": "salt",
  "kind": "ingredient",
  "names": {
    "en": "Salt",
    "es": "Sal"
  },
  "aggregationState": "granular",
  "structure": {
    "composite": false,
    "components": []
  },
  "composition": {
    "chemicalFormula": "NaCl",
    "nutrientsPer100g": {
      "sodium_mg": 39337
    },
    "citation": {
      "source": "Computed from IUPAC standard atomic weights (Na 22.98977, Cl 35.453) — sodium's mass fraction in NaCl (22.98977/58.44277 = 39.337%) times 100g, not looked up from a food-composition table",
      "confidence": "standard_reference",
      "note": "Found and fixed 2026-08-12: the previous value (38758mg) was off by 1.49% from the exact stoichiometric figure — checked while adding citations generally, not flagged before. This is the one composition figure in this repo that's exactly derivable rather than an empirical/approximate figure, since table salt is essentially pure NaCl by definition."
    }
  },
  "possibleStates": ["dry", "wet", "dissolved"],
  "allowedTransformations": [],
  "producedByproducts": [],
  "capabilities": {
    "isDissolvable": true,
    "isSeasoning": true,
    "isSaltySeasoning": true,
    "isChoppable": false,
    "isWashable": false
  },
  "thermophysical": {
    "densityKgPerM3": 2170,
    "meltingPointC": 801,
    "boilingPointC": 1413,
    "citation": {
      "source": "CRC Handbook of Chemistry and Physics — standard reference values for sodium chloride",
      "confidence": "standard_reference",
      "note": "A meaningfully higher-confidence category than a food's composition/thermophysical figures elsewhere in this repo (potato.json, egg.json, ...): these are properties of a pure, well-characterized chemical compound with essentially no natural variance, not a biological product averaged across cultivars/specimens."
    }
  },
  "sensory": {
    "taste": ["salty"],
    "texture": ["granular", "crystalline"],
    "color": "white"
  },
  "cooklang": {
    "canonicalToken": "sal",
    "spiceLock": true
  },
  "metadata": {
    "commonName": "table salt",
    "casNumber": "7647-14-5",
    "notes": "spiceLock reflects CLAUDE_DEV_CTX.md's Cooklang interop rule: '='-prefixed quantities don't scale linearly with recipe size — salt is the canonical example.",
    "capabilityNote": "isSaltySeasoning added 2026-08-13, alongside the generic isSeasoning, when black_pepper.json/chili_flakes.json were added as the first other isSeasoning entities: data/actions/salt.json's requiredIngredientCapabilities now checks isSaltySeasoning specifically, not the generic isSeasoning — otherwise SALT would have silently accepted pepper or chili flakes as satisfying 'a salt-like ingredient is present' the moment a second isSeasoning entity existed. isSeasoning itself stays true here too, for a genuinely different purpose: 'is this entity a seasoning at all' (useful for a future generic query), distinct from 'is this entity THE seasoning this specific verb needs'.",
    "todo": "isDissolvable capability is asserted true, but allowedTransformations is empty until a 'dissolve' verb exists in data/actions/ — see scripts/validate.ts's cross-reference check."
  }
}
````

## File: data/recipes/handmade-alioli-egg-yolk.json
````json
{
  "id": "handmade_alioli_egg_yolk",
  "names": {
    "en": "Handmade Alioli with Egg Yolk",
    "es": "Alioli Casero con Yema de Huevo"
  },
  "initialInventory": [
    { "id": "garlic-1", "entityId": "garlic", "state": "raw", "tags": [] },
    { "id": "egg-1", "entityId": "egg", "state": "raw", "tags": [] },
    { "id": "oil-1", "entityId": "oil", "state": "cold", "tags": [] },
    {
      "id": "salt-1",
      "entityId": "salt",
      "state": "dry",
      "tags": [],
      "quantity": {
        "kind": "imprecise",
        "descriptor": "pinch",
        "approxRangeGrams": { "min": 0.3, "max": 0.6 },
        "citation": {
          "source": "Commonly cited culinary conversion: 1 pinch \u2248 1/16 tsp of fine table salt",
          "confidence": "commonly_cited_unverified",
          "note": "Genuinely imprecise by convention, not just uncited \u2014 cooks don't measure a pinch. Also varies by crystal size (fine vs. coarse), which this repo doesn't model as a separate entity yet \u2014 see QuantitySchema's doc comment (ingredient.ts)."
        }
      }
    }
  ],
  "availableTools": ["knife", "mortar", "pot"],
  "sequence": [
    { "actionId": "peel", "targetInstanceId": "garlic-1", "params": {}, "availableIngredientInstanceIds": [] },
    { "actionId": "salt", "targetInstanceId": "garlic-1", "params": {}, "availableIngredientInstanceIds": ["salt-1"] },
    { "actionId": "crush", "targetInstanceId": "garlic-1", "params": { "fineness": "fine_paste" }, "availableIngredientInstanceIds": [] },
    { "actionId": "separate", "targetInstanceId": "egg-1", "params": {}, "availableIngredientInstanceIds": [] },
    {
      "actionId": "pasteurize",
      "targetInstanceId": "egg_yolk-3",
      "params": { "waterTempC": "60", "durationSeconds": "210" },
      "availableIngredientInstanceIds": []
    },
    {
      "actionId": "emulsify",
      "targetInstanceId": "garlic-1",
      "params": { "oilAdditionRate": "slow_stream", "durationSeconds": "240" },
      "availableIngredientInstanceIds": ["oil-1", "egg_yolk-3"]
    }
  ],
  "metadata": {
    "notes": "Sibling of handmade-alioli.json (see that file's metadata.comparisonGroup) — same tools plus 'pot', same peel -> salt -> crush(fine_paste) opening on garlic-1, same EMULSIFY action/target. Reordered 2026-08-12: SEPARATE now runs FIRST, PASTEURIZE targets egg_yolk-3 directly afterward — not the whole egg. This is real, standard commercial practice (liquid/broken egg products ARE pasteurized after breaking, in bulk), not a shortcut: see data/ccps/egg_pasteurization_liquid.json.",
    "mathSimplification": "PASTEURIZE now runs 60°C for 210s (3.5 min) instead of the old 57°C for 3900s (65 min) — a real ~18x reduction in wait time, not an arbitrary shortcut: egg_pasteurization_liquid.json's 60°C/210s is a commonly-cited USDA-regulated figure for already-liquid egg product, and — this is the actual point — it's now backed by a computable D/z thermal-death-time model (thermal.ts), not just a second hand-picked anchor. Computed, not asserted: at the SAME 57°C the old in-shell recipe used, the liquid model predicts ~975s (~16 min) would suffice IF the yolk were actually at 57°C throughout — the old recipe's real 3900s figure being ~4x longer than that is the measurable signature of the shell's heat-penetration lag (egg_pasteurization_liquid.json's shellLagFinding). Once the shell is off, that lag is gone, and the real, faster, standard liquid-pasteurization figure legitimately applies — this isn't corner-cutting, it's using the correct model for the actual physical situation.",
    "safetyHistory": "This recipe originally had ZERO food-safety enforcement (raw yolk, never heated anywhere in the sequence). Fixed once with in-shell PASTEURIZE-then-SEPARATE; fixed again here to use the more standard, faster, better-sourced liquid-pasteurization path instead, once it existed. egg_pasteurization_liquid.json's advisoryOnly: false is unchanged from the in-shell CCP's posture — still a hard reject in every SafetyPolicy mode, not a warning; there's still no 'the child knowingly accepted this' framing for silently skipping pasteurization.",
    "remainingGap": "Unchanged from before: the engine does not HARD-BLOCK a DIFFERENT recipe from feeding an unpasteurized egg_yolk into EMULSIFY directly — requiredIngredientCapabilities only checks presence of a capability, not a tag on the specific instance satisfying it. Still a real, stated gap, not silently resolved by this change."
  }
}
````

## File: src/registry.ts
````typescript
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EntitySchema, type Entity } from "./ingredient.ts";
import { ActionSchema, type Action } from "./action.ts";
import { RecipeScriptSchema, type RecipeScript } from "./recipe.ts";
import { CriticalControlPointSchema, type CriticalControlPoint } from "./thermal.ts";
import { HeatSourceProfileSchema, type HeatSourceProfile } from "./heat-source.ts";

/** Parses every *.json file in `dir` against `schema`, keyed by its `id`. Throws on the first invalid file. */
function loadDir<T extends { id: string }>(
  dir: string,
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }
): Map<string, T> {
  const items = new Map<string, T>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const result = schema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Invalid ${file}: ${issues}`);
    }
    items.set(result.data.id, result.data);
  }
  return items;
}

export function loadEntities(entitiesDir: string): Map<string, Entity> {
  return loadDir(entitiesDir, EntitySchema);
}

export function loadActions(actionsDir: string): Map<string, Action> {
  return loadDir(actionsDir, ActionSchema);
}

export function loadRecipes(recipesDir: string): Map<string, RecipeScript> {
  return loadDir(recipesDir, RecipeScriptSchema);
}

export function loadCcps(ccpsDir: string): Map<string, CriticalControlPoint> {
  return loadDir(ccpsDir, CriticalControlPointSchema);
}

export function loadHeatSources(heatSourcesDir: string): Map<string, HeatSourceProfile> {
  return loadDir(heatSourcesDir, HeatSourceProfileSchema);
}
````

## File: data/entities/egg_yolk.json
````json
{
  "id": "egg_yolk",
  "kind": "ingredient",
  "names": {
    "en": "Egg yolk",
    "es": "Yema de huevo"
  },
  "aggregationState": "emulsion",
  "structure": {
    "composite": false,
    "components": []
  },
  "composition": {
    "nutrientsPer100g": {
      "water_g": 50,
      "protein_g": 16,
      "fat_g": 27
    },
    "citation": {
      "source": "USDA FoodData Central (fdc.nal.usda.gov), raw egg yolk",
      "confidence": "standard_reference",
      "note": "Same caveat as egg.json — not checked against the exact current FDC entry."
    }
  },
  "possibleStates": ["raw", "blended"],
  "possibleTags": ["pasteurized"],
  "allowedTransformations": ["mix", "pasteurize"],
  "producedByproducts": [],
  "criticalControlPointsByAction": {
    "pasteurize": "egg_pasteurization_liquid"
  },
  "capabilities": {
    "isBlendable": true,
    "isEmulsionStabilizer": true,
    "isPasteurizable": true
  },
  "sensory": {
    "taste": ["neutral"],
    "texture": ["thick", "creamy"],
    "color": "yellow"
  },
  "cooklang": {
    "canonicalToken": "yema",
    "spiceLock": false
  },
  "metadata": {
    "producedBy": ["separate"],
    "notes": "aggregationState 'emulsion' rather than 'liquid' or 'paste': raw yolk is the textbook example of a natural food emulsion (lecithin-stabilized fat-in-water), and the schema's enum has a dedicated value for exactly this case. Byproduct entity spawned when 'separate' is applied to egg.json (see EntitySchema.producedByproducts on egg) — mirrors potato_peel.json's producedBy convention for potato's 'peel' byproduct.",
    "todo": "isBlendable/mix reuses the existing MIX action (data/actions/mix.json, mixer tool) — same mechanism as potato_peel.json. MIX has no intensity/duration parameter yet, so 'mixed a little vs. a lot' isn't distinguishable, just raw-vs-blended; whipping to stiff peaks, curing, or tempering into a sauce still aren't modeled.",
    "emulsionStabilizerNote": "isEmulsionStabilizer reflects lecithin's real role as a much more effective, forgiving emulsifier than garlic's own mucilage alone — see data/actions/emulsify.json's eggComparisonNote and data/recipes/handmade-alioli-egg-yolk.json, the egg-yolk variant of handmade-alioli.json built specifically to compare the two. NOT added to emulsify.json's requiredIngredientCapabilities (that stays isEmulsifier/oil only, unchanged) — doing so would newly require egg_yolk for the original egg-free recipe too, breaking the exact 'no egg, mortar and patience' distinction that recipe exists to demonstrate. Its presence in the egg-yolk recipe's availableIngredientInstanceIds is informational/provenance only, same honesty limitation as fry.json's doneness — the engine has no mechanism to causally derive 'faster because lecithin is present' from an ingredient's mere presence.",
    "pasteurizedTagNote": "possibleTags: ['pasteurized'] originally existed only to RECEIVE the tag from pasteurizing the whole egg before SEPARATE (tag inheritance through spawning). Superseded 2026-08-12 by a more realistic, more standard path: isPasteurizable + criticalControlPointsByAction.pasteurize now let PASTEURIZE run directly on the separated yolk (egg_pasteurization_liquid.json — 60°C/210s, a real USDA-cited figure, backed by an actual computable D/z model, not the in-shell process's 57°C/65min) — commercial liquid egg products are genuinely pasteurized this way (broken/pooled, then heat-treated), not just an engine convenience. The old inherited-tag path (pasteurize whole, then separate) still works and is still valid if that's the actual technique used — this entity just isn't limited to it anymore. See data/recipes/handmade-alioli-egg-yolk.json for the updated recipe and data/ccps/egg_pasteurization_liquid.json's shellLagFinding for why the two processes need genuinely different required times, computed, not asserted."
  }
}
````

## File: src/recipe-runner.ts
````typescript
import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import type { RecipeScript, RecipeStep } from "./recipe.ts";
import type { CriticalControlPoint } from "./thermal.ts";
import { applyAction, type Instance, type SafetyPolicy } from "./engine.ts";

/**
 * Walks a RecipeScript's sequence against engine.ts's applyAction, the way
 * CLAUDE_DEV_CTX.md's reference OcrValidationEngine walks recipe.sequence —
 * but built on the capability/parameter/tag model this codebase actually
 * has, not that reference's INVALID_TRANSITIONS matrix (still Phase 4).
 *
 * A step's failure does not halt the recipe: it's recorded in `errors` and
 * the run continues, mirroring the reference engine's "collect all errors,
 * then report" behavior rather than throwing on the first problem.
 *
 * `RecipeStep.secondaryInstanceId` (COMBINE-shaped actions, engine.ts's
 * `secondaryInstance`) is resolved from inventory the same way
 * `targetInstanceId` is, and removed from inventory afterward if
 * `result.secondaryDestroyed` — the same treatment `destroyed` already gets
 * for the primary target.
 */

export interface RecipeStepError {
  step: RecipeStep;
  message: string;
}

export interface RecipeRunResult {
  finalInventory: Map<string, Instance>;
  errors: RecipeStepError[];
  log: string[];
  /** Non-fatal HACCP notices collected across the whole run — see
   *  engine.ts's ExecutionResult.warnings / advisoryOnly CCPs. */
  warnings: string[];
}

export function runRecipe(
  recipe: RecipeScript,
  entities: Map<string, Entity>,
  actions: Map<string, Action>,
  ccps: Map<string, CriticalControlPoint> = new Map(),
  policy?: SafetyPolicy
): RecipeRunResult {
  const inventory = new Map<string, Instance>();
  for (const item of recipe.initialInventory) {
    inventory.set(item.id, { entityId: item.entityId, state: item.state, tags: [...item.tags] });
  }

  const availableTools = new Set(recipe.availableTools);
  const log: string[] = [];
  const errors: RecipeStepError[] = [];
  const warnings: string[] = [];
  let spawnCounter = 0;

  for (const step of recipe.sequence) {
    const action = actions.get(step.actionId);
    const instance = inventory.get(step.targetInstanceId);

    if (!action) {
      errors.push({ step, message: `Unknown action "${step.actionId}"` });
      continue;
    }
    if (!instance) {
      errors.push({ step, message: `Unknown target instance "${step.targetInstanceId}"` });
      continue;
    }
    let secondaryInstance: Instance | undefined;
    if (step.secondaryInstanceId) {
      secondaryInstance = inventory.get(step.secondaryInstanceId);
      if (!secondaryInstance) {
        errors.push({ step, message: `Unknown secondary instance "${step.secondaryInstanceId}"` });
        continue;
      }
    }

    const availableIngredientEntityIds = new Set(
      step.availableIngredientInstanceIds
        .map((id) => inventory.get(id)?.entityId)
        .filter((id): id is string => id !== undefined)
    );

    try {
      const result = applyAction(
        instance,
        action,
        entities,
        availableTools,
        step.params,
        availableIngredientEntityIds,
        ccps,
        policy,
        secondaryInstance
      );
      const tagsLabel = result.instance.tags.length ? `, tags [${result.instance.tags}]` : "";
      for (const warning of result.warnings) {
        warnings.push(warning);
        log.push(`  WARNING: ${warning}`);
      }
      if (result.destroyed) {
        inventory.delete(step.targetInstanceId);
        log.push(
          `${action.verb} ${step.targetInstanceId}: state "${instance.state}" -> "${result.instance.state}"${tagsLabel} (destroyed — conservation of mass)`
        );
      } else {
        inventory.set(step.targetInstanceId, result.instance);
        log.push(
          `${action.verb} ${step.targetInstanceId}: state "${instance.state}" -> "${result.instance.state}"${tagsLabel}`
        );
      }
      if (result.secondaryDestroyed && step.secondaryInstanceId) {
        inventory.delete(step.secondaryInstanceId);
        log.push(`  consumed secondary instance ${step.secondaryInstanceId} (${secondaryInstance!.entityId})`);
      }
      for (const spawned of result.spawned) {
        const spawnedId = `${spawned.entityId}-${++spawnCounter}`;
        inventory.set(spawnedId, spawned);
        log.push(`  spawned ${spawnedId} (${spawned.entityId}, state: "${spawned.state}")`);
      }
    } catch (err) {
      const message = (err as Error).message;
      errors.push({ step, message });
      log.push(`REJECTED ${action.verb} ${step.targetInstanceId}: ${message}`);
    }
  }

  return { finalInventory: inventory, errors, log, warnings };
}
````

## File: data/actions/fry.json
````json
{
  "id": "fry",
  "verb": "FRY",
  "names": {
    "en": "Fry",
    "es": "Freír"
  },
  "requiredTools": [
    "pan"
  ],
  "requiredTargetCapability": "isFryable",
  "validTargetKinds": [
    "ingredient"
  ],
  "requiredIngredientCapabilities": [
    "isFryingMedium"
  ],
  "parameters": [
    {
      "id": "heatLevel",
      "names": {
        "en": "Heat level",
        "es": "Nivel de fuego"
      },
      "required": false,
      "allowedValues": [
        "low",
        "medium",
        "high"
      ]
    },
    {
      "id": "durationSeconds",
      "names": {
        "en": "Duration",
        "es": "Duración"
      },
      "required": false,
      "numericRange": {
        "unit": "seconds",
        "min": 10,
        "max": 1800
      }
    },
    {
      "id": "agitation",
      "names": {
        "en": "Agitation",
        "es": "Agitación"
      },
      "required": false,
      "allowedValues": [
        "undisturbed",
        "occasional_nudge",
        "constant_stir"
      ]
    },
    {
      "id": "doneness",
      "names": {
        "en": "Doneness",
        "es": "Punto de cocción"
      },
      "required": false,
      "allowedValues": [
        "golden",
        "brown"
      ]
    },
    {
      "id": "yolkDoneness",
      "names": {
        "en": "Yolk doneness",
        "es": "Punto de la yema"
      },
      "required": false,
      "allowedValues": [
        "runny",
        "medium",
        "well_done"
      ]
    },
    {
      "id": "edgeStyle",
      "names": {
        "en": "Edge style",
        "es": "Estilo del borde"
      },
      "required": false,
      "allowedValues": [
        "plain",
        "crispy_lace_puntilla"
      ]
    },
    {
      "id": "internalTexture",
      "names": {
        "en": "Internal texture",
        "es": "Textura interior"
      },
      "required": false,
      "allowedValues": [
        "baveuse",
        "soft_set",
        "fully_set"
      ]
    }
  ],
  "outputs": {
    "transformedState": "fried",
    "spawnsTargetByproducts": false
  },
  "duration": "variable",
  "precision": "optional",
  "metadata": {
    "notes": "First reuse path for a byproduct: potato_peel.json is isFryable, so the potato_peel instance spawned by 'peel' isn't a dead end — it can flow back through the engine (fried into crisps) instead of only ever being discarded. requiredIngredientCapabilities: needs a frying medium (oil.json) present, on top of the pan tool and the target itself.",
    "parameterNotes": "None of heatLevel/durationSeconds/agitation/doneness are state-determining (transformedState stays fixed at 'fried') or required — FRY covers potato, egg, and garlic, with very different typical durations, so durationSeconds' range is deliberately wide (10s-30min) rather than tuned to any one of them. heatLevel is descriptive only: low/medium/high map loosely to ~120-150°C / ~150-190°C / ~190-230°C+ pan-surface bands (commonly cited ranges in culinary-science references, e.g. Harold McGee's On Food and Cooking, for the Maillard range and typical shallow-frying temps) — not a measured, enforced value. agitation is what distinguishes an omelette reading of this action (undisturbed, held as a sheet) from a rougher stir-fried style; true continuous scrambling is its own verb, see scramble.json. See data/entities/egg.json / egg_cracked.json's criticalControlPointsByAction for how durationSeconds actually gets checked against a real safety threshold when frying egg.",
    "donenessNote": "Added for garlic specifically ('golden' vs 'brown' — e.g. toasted for garlic-infused oil, see infuse.json), but deliberately kept as informational-only like the others rather than made state-determining via transformedStateFromParameter: doing that would require EVERY caller of this shared action (potato, egg, garlic) to always supply a doneness value the moment any one of them wants a distinct outcome state, since ActionOutputsSchema only supports one fixed transformedState OR one parameter-driven state for the whole action, not 'fixed by default, overridable per-call' — the engine has no default-value concept for transformedStateFromParameter. A genuinely distinct 'browned garlic' state would need either that engine feature, or a separate verb (like SCRAMBLE was split from FRY) — not done here since 'fried' + doneness recorded for provenance is an honest, sufficient, non-breaking answer to 'cook it until brown'.",
    "yolkDonenessNote": "'doneness' (golden/brown) is SURFACE color — irrelevant to how a fried/poached egg is actually ordered, which is overwhelmingly about the YOLK (huevo frito: '¿con la yema líquida o cuajada?' — runny or set). A distinct parameter, not an overload of 'doneness', because they answer genuinely different questions and both can matter at once (a fried egg can be golden-edged AND runny-yolked). Directly connects to real safety machinery already built: 'runny' is the FDA Food Code's 'increased risk, disclosed' case egg_cooking.json's advisoryOnly:true exists for — a robot fulfilling a 'runny yolk' order should expect the resulting durationSeconds to be short enough to trigger that CCP's warning (human mode) or require an explicit humanOverrides entry (autonomous mode), not treat the warning as a bug to route around. 'well_done' should reliably clear the CCP with room to spare. This parameter doesn't itself drive that outcome (informational only, like every other parameter here) — the actual duration chosen has to be consistent with it, which is on whoever authors the recipe/plan, not enforced by the schema.",
    "edgeStyleNote": "'crispy_lace_puntilla' names a specific, real Spanish tapas-bar technique for huevo frito: hot oil is repeatedly spooned/basted over the egg while frying (rather than just letting it sit in a shallow pool), causing the white's edges to bubble, blister, and crisp into a lacy, golden, crunchy border ('puntilla' — lit. 'little point/edging', as in lace trim) distinct from the soft, plain edge of a dry- or lightly-oiled fried egg. A real technique difference (more oil, active basting motion vs. passive), not just a name for the same result — informational only, same limits as every other parameter here: this records what was asked for, it doesn't make the pan baste itself.",
    "internalTextureNote": "For egg_cracked specifically (the omelette reading of FRY, agitation: undisturbed — see egg_cracked.json). Exists because 'tortilla francesa' (the common Spanish name for a plain beaten-egg omelette) and 'French omelette' (the specific classical French technique) are NOT reliably the same dish despite the near-identical name: a Spanish tortilla francesa is typically cooked through and served FLAT, unfolded ('fully_set' here); the classical French omelette is cooked fast over higher heat, left deliberately soft/custardy inside ('baveuse'), and rolled/folded before serving (see data/actions/fold.json — egg_cracked.json's isFoldable). Same starting entity, same FRY action, genuinely different intended outcome depending on which was actually meant. This model can represent either precisely; it cannot itself resolve which a customer meant by the word 'omelette' or 'tortilla francesa' — that's the LLM-intent-parsing layer's job (CONCEPT.md §14: LLM produces a structured Intent, never decides which dish rule applies), not something to guess at here. See data/recipes/tortilla-francesa.json and data/recipes/french-omelette.json for both, built explicitly to make this disambiguation concrete rather than just asserted.",
    "retrySafeNote": "retrySafe: true at the DATA/INVENTORY level only (no duplication, no engine error) — NOT a claim that repeating it is culinarily harmless. Re-running this on an already-finished result risks overcooking/over-working the actual dish, a real physical risk this schema-level flag can't and shouldn't paper over."
  },
  "verification": {
    "method": "visual",
    "description": "Surface color/texture matches the requested doneness (golden/brown, or yolk set per yolkDoneness)",
    "confidence": "medium"
  },
  "hazards": [
    {
      "type": "hot_oil",
      "severity": "high",
      "note": "Hot oil splatter; pan-surface contact burn risk"
    }
  ],
  "retrySafe": true
}
````

## File: data/entities/egg_cracked.json
````json
{
  "id": "egg_cracked",
  "kind": "ingredient",
  "names": {
    "en": "Cracked egg",
    "es": "Huevo batido"
  },
  "aggregationState": "liquid",
  "structure": {
    "composite": false,
    "components": []
  },
  "composition": {
    "nutrientsPer100g": {
      "water_g": 76,
      "protein_g": 13,
      "fat_g": 11,
      "carbohydrate_g": 1.1
    },
    "citation": {
      "source": "USDA FoodData Central (fdc.nal.usda.gov), raw whole egg — cracking doesn't change composition, only physical form, so egg.json's citation applies unchanged",
      "confidence": "standard_reference"
    }
  },
  "possibleStates": ["raw", "lightly_beaten", "beaten", "well_beaten", "fried", "scrambled"],
  "possibleTags": ["salted", "peppered", "chili_seasoned", "flipped", "folded"],
  "allowedTransformations": ["beat", "fry", "scramble", "salt", "pepper", "chili", "flip", "combine", "fold"],
  "statePrerequisites": {
    "fold": "fried"
  },
  "producedByproducts": [],
  "criticalControlPointsByAction": {
    "fry": "egg_cooking",
    "scramble": "egg_cooking"
  },
  "capabilities": {
    "isFryable": true,
    "isBeatable": true,
    "isScramblable": true,
    "isSeasonable": true,
    "isFlippable": true,
    "isCombinableAddition": true,
    "isFoldable": true
  },
  "sensory": {
    "taste": ["neutral"],
    "texture": ["viscous"],
    "color": "pale yellow"
  },
  "cooklang": {
    "canonicalToken": "huevo_batido",
    "spiceLock": false
  },
  "metadata": {
    "producedBy": ["crack"],
    "notes": "Yolk and white opened out of the shell but deliberately NOT split apart — the entry point for scrambled eggs and the plain/French omelette (tortilla francesa), as opposed to egg_yolk/egg_white (data/entities/egg_yolk.json, egg_white.json) which come from SEPARATE. FRY on this entity ('fried', undisturbed sheet) reads as an omelette; SCRAMBLE ('scrambled', stirred curds) is the other outcome of the same pan+oil setup. isBeatable/BEAT (bowl, not mixer — data/actions/beat.json) replaced an earlier isBlendable/MIX wiring: MIX had no way to express 'a little vs. a lot', while BEAT's 'intensity' parameter (lightly_beaten/beaten/well_beaten) does, and a bowl-and-fork is the actual tool for this, not an electric mixer. Entirely optional and reachable from 'raw' either way — FRY/SCRAMBLE don't require a prior BEAT.",
    "haccpNote": "Carries the same egg_cooking CCP (data/ccps/egg_cooking.json) as the whole egg, on FRY/SCRAMBLE specifically — cracking and combining yolk/white is, if anything, a slightly *higher*-risk step than an intact shell egg (more surface exposed, potential pooling if multiple eggs are cracked together), which is exactly the FDA Food Code's own reasoning for treating broken/combined eggs 'for immediate service' under the same strict time-temperature standard as pooled eggs generally.",
    "flipNote": "isFlippable added for the plain/French omelette case (FLIP an already-frying egg_cracked to cook its second side) — cheap, directly reuses data/actions/flip.json as-is, no new machinery needed beyond what tortilla_mixture.json already required.",
    "combineNote": "isCombinableAddition: the secondary instance data/actions/combine.json consumes (poured over already-fried potato — see potato.json's combineNote). No statePrerequisite enforcing 'must be beaten first': engine.ts's statePrerequisites only supports one exact required state string, and 'lightly_beaten' OR 'beaten' OR 'well_beaten' should all be valid real inputs — expressing 'any of these three' isn't something the current mechanism can do, so this is left as a real-world expectation, not an enforced one.",
    "seasoningNote": "pepper/chili added 2026-08-13 alongside salt — see potato.json's identical seasoningNote.",
    "foldNote": "isFoldable + statePrerequisites.fold: 'fried' — the classical French omelette's rolled/folded shape, applied AFTER frying (data/actions/fold.json), not before. The Spanish tortilla francesa reading of this same entity (FRY, agitation: undisturbed, fully_set) simply never calls FOLD — both are equally valid, equally supported outcomes of the same starting entity; which one a request means is resolved upstream, not by this schema. See fry.json's internalTextureNote and data/recipes/tortilla-francesa.json / french-omelette.json."
  }
}
````

## File: CLAUDE.md
````markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

Past the planning-only stage: `src/` has a working schema/engine (`ingredient.ts`,
`action.ts`, `engine.ts`, `recipe.ts`, `recipe-runner.ts`, `registry.ts`, `thermal.ts`,
`heat-source.ts`, `egg-doneness.ts`), `data/` has real entities/actions/recipes/CCPs/
heat-sources (potato, egg + its byproducts, garlic, alioli variants, gas/vitro/wood
heat providers, ...), and `scripts/` has runnable demos plus `validate.ts`. Commands:
`npm test` (`node:test` unit suite over `tests/*.test.ts` — synthetic fixtures against
`engine.ts`/`action.ts`/`ingredient.ts`/`thermal.ts`, no `data/*.json` dependency),
`npm run validate` (schema + cross-reference check over the real `data/*.json` — the
authoritative integration check), `npm run demo:<name>` (see `package.json` for the
full list), `npm run recipe -- <id>`, `npx tsc -p . --noEmit` (typechecks `src`,
`scripts`, AND `tests` — pre-existing `TS5097` import-extension noise across the repo
is unrelated to any change; filter with `grep -v TS5097`). `npm test` and
`validate.ts` are complementary, not alternatives (see `LEARNINGS.md` 2026-08-13) —
run both, plus every demo and every recipe, after any change to `src/`, not just the
new thing.

**Before starting work, read `LEARNINGS.md`.** After learning something that would've
saved time going in — a schema constraint, an engine gotcha, a design tradeoff and why
— append a dated entry there. Don't just re-derive the same surprise next session, and
don't let this section (or any other doc here) go stale the way this one just did:
when the repo's real shape changes, update the doc that describes it in the same
change, not "later."

## What this repo is for

`CLAUDE_DEV_CTX.md` is the design blueprint for the **Open Culinary Runtime (OCR)**, a project that models recipes as deterministic, executable state machines (an Entity-Component-System, not static text) rather than prose instructions. Treat it as the system prompt/spec for any code written in this repo — new files should follow its architecture rather than a generic recipe-app design.

### Core architectural pillars

- **Entities ("What")** — physical, reusable objects. Consumable ingredients (e.g. "potato") are modeled separately from reusable cookware/utensils (e.g. "frying-pan", "chef-knife").
- **States ("Physical conditions")** — observable conditions of an entity (e.g. "raw", "peeled", "chopped", "boiled", "liquid").
- **Actions ("Changes")** — transformations that act as transition boundaries: they consume inputs in State A and yield outputs in State B.
- **Parameters ("Culinary details")** — quantitative modifiers: physics, timing (seconds), and safety-critical thresholds (HACCP).

### Simulation rules that any engine code must enforce

- **Conservation of mass/entities** — executing a step (e.g. "separate") destroys the parent entity in the inventory and spawns disjoint child entities in its place (e.g. "egg_yolk" + "egg_white").
- **Physical feasibility restrictions** — block state transitions that are physically impossible (e.g. can't "peel" something already "boiled"; can't "chop" something "mashed" or "liquid"). See the `INVALID_TRANSITIONS` map in the reference engine below for the canonical forbidden-transition table.
- **HACCP critical control points** — thermal steps must enforce food-safety thresholds (e.g. minimum internal temperature of 135°F held for at least 15 seconds).
- **Cooklang interoperability** — Cooklang is the primary human-writable authoring format. Preserve backward compatibility with its scaling multipliers and spice locks (quantities prefixed with `=` do not scale linearly).
- **Schema.org is a lossy export target** — Schema.org JSON-LD is a flat target for search-engine indexing only. Conversions from rich, nested OCR JSON to Schema.org must be one-directional (lossless OCR → lossy Schema.org), not treated as a round-trippable source of truth.

### Module layout — as planned vs. as actually built

`CLAUDE_DEV_CTX.md`'s original file split didn't survive contact with incremental,
additive real work; the actual layout diverged under different names. Both are
listed so neither this file nor `CLAUDE_DEV_CTX.md` alone gives a false picture:

| Planned (`CLAUDE_DEV_CTX.md`) | What actually exists | Notes |
|---|---|---|
| `ingredient.ts` — `EntitySchema`, `RecipeIngredientSchema`, `ParsedIngredientSchema` | `src/ingredient.ts` — `EntitySchema` + `QuantitySchema` (`RecipeIngredientSchema`, closed 2026-08-13, used as `recipe.ts`'s `RecipeInstanceSchema.quantity`) | `ParsedIngredientSchema` not built; nothing consumes raw scraper output yet (Phase 5/7 still unstarted) |
| `recipe-step.ts` — `EntityStateSchema`, `CriticalControlPointSchema`, `MechanicalActionSchema` | Split across `src/engine.ts` (`Instance` ≈ `EntityStateSchema`), `src/action.ts` (`Action`/`ActionOutputsSchema` ≈ `MechanicalAction`), `src/thermal.ts` (`CriticalControlPointSchema`, built as named) | No single `recipe-step.ts` — the concept fragmented across three files as the engine grew organically |
| `recipe.ts` — `RecipeScriptSchema` | `src/recipe.ts` — built close to as planned | plus `src/recipe-runner.ts` (not in the original plan) actually walks a `RecipeScript` against `engine.ts` |
| `nutrition-extension.ts` | Not built | |
| `ocr-engine.ts` — `OcrValidationEngine`, `INVALID_TRANSITIONS` | `src/engine.ts`'s `applyAction` covers part of this (capability/tool/state-prerequisite checks, conservation of mass, HACCP + `SafetyPolicy`) but there is **no `INVALID_TRANSITIONS` forbidden-transition matrix** — still `ROADMAP.md` Phase 4, unchecked | Also not a class named `OcrValidationEngine` — a plain function |
| `ocr-converter.ts` — `compileToSchemaOrgIngredient`, Cooklang parser | Not built | `cooklang` fields exist on entities (`canonicalToken`, `spiceLock`) but nothing reads/writes actual Cooklang text yet |

`src/registry.ts` (loading `data/*.json` by directory into typed `Map`s) also isn't
in the original plan — the whole `data/` directory of JSON files, validated against
these schemas rather than defined in TypeScript, is itself a divergence from
`CLAUDE_DEV_CTX.md`'s framing, though a compatible one.

Two more files with no counterpart in the original plan, both added 2026-08-13:
`src/heat-source.ts` (`HeatSourceProfileSchema` + `estimatedPreheatSeconds`,
`data/heat-sources/*.json`: gas/vitro/wood — real, cited heat-provider performance
data, e.g. "how long to boil water on a wood fire vs. gas") and
`src/egg-doneness.ts` (`EGG_BOIL_DONENESS`, a real cited seconds-range table for
`boil.json`'s `yolkDoneness` — closes the "if I tell a robot medium boiled, I want it
to understand it" gap at the reference-data layer). Both are CCP-shaped (their own
top-level `data/` collection + schema + `registry.ts` loader, mirroring
`thermal.ts`/`data/ccps/`) rather than fields grafted onto `EntitySchema` — see
`LEARNINGS.md` 2026-08-13 for why, and `ROADMAP.md`'s "Common culinary knowledge
coverage" section for the surrounding context this was built under.

Read `CLAUDE_DEV_CTX.md` for the *concepts* (still accurate) — verify file/symbol
names against the table above or `ROADMAP.md`, not against that file's original
naming, before assuming something exists.

### Planned satellite projects

`CLAUDE_DEV_CTX.md` also scopes three follow-on assignments; check with the user which (if any) is in scope before generating code for them, since they imply different languages/runtimes than the core TS engine:

1. **Web scraper pipeline (Python / BeautifulSoup)** — fetch a recipe URL, extract `<script type="application/ld+json">`, tokenize the lossy `recipeIngredient` strings into quantity/unit/name/preparation, generate Cooklang text, compile to an executable OCR JSON script.
2. **Mobile reference app (React Native + Expo)** — 4-tab navigator: Discover (local recipe search), Community (feed with `FormData` uploads + `onUploadProgress`), Meal Plan (`.menu` schedule parsing), Profile (JWT with auto-logout on expiry).
3. **Home Assistant HACS component (Python)** — talks to a local CookCLI server at `http://localhost:9080`; sensors for expiring food / depleted pantry; populates HA Calendar from `.menu` schedules.

## A Gemini CLI config was found

`~/.gemini/settings.json` exists on this machine (user-level, not project-level). If you want its MCP servers/instructions/etc. available in Claude Code, reply `/import` to scan it.
````

## File: src/action.ts
````typescript
import { z } from "zod";
import { EntityKindSchema } from "./ingredient.ts";

/**
 * Verbs Dictionary — canonical Action definitions.
 *
 * "Actions know themselves" (CONCEPT.md §1/§7): an Action is knowledge, not
 * code, and it is defined once, independently of any recipe or specific
 * ingredient that later uses it (ENGINE_INVARIANTS.md #2 "Actions never know
 * recipes"). One JSON file per verb under `data/actions/*.json`.
 *
 * This is distinct from the planned `recipe-step.ts` `MechanicalActionSchema`
 * (not implemented yet): that will describe one *instance* of a verb inside
 * a specific recipe's sequence (this target, these actual inputs/outputs).
 * `ActionSchema` here describes the verb itself, once, the same way
 * `EntitySchema` describes an ingredient/tool once.
 */

/**
 * A "Parameter" — CLAUDE_DEV_CTX.md's 4th pillar, "Culinary Details":
 * quantitative/qualitative details modifying a specific action. Two shapes:
 *
 * - `allowedValues`: a closed set (CUT's "shape", BEAT's "intensity"). A
 *   value here can double as a state id when
 *   `outputs.transformedStateFromParameter` points at it.
 * - `numericRange`: a continuous physical quantity that a closed enum can't
 *   honestly represent — CLAUDE_DEV_CTX.md's own "timing (seconds)" and
 *   "physics" examples (e.g. FRY's durationSeconds, POACH's waterTempC).
 *   Never state-determining — engine.ts only range-checks it, and it can
 *   feed a CriticalControlPointSchema check (thermal.ts) instead.
 *
 * Exactly one of the two must be set.
 */
export const ActionParameterSchema = z
  .object({
    id: z.string().min(1),
    names: z.record(z.string(), z.string()).optional(),
    required: z.boolean().default(true),
    allowedValues: z.array(z.string()).min(1).optional(),
    numericRange: z
      .object({
        unit: z.string().min(1),
        min: z.number(),
        max: z.number(),
      })
      .optional(),
  })
  .refine((p) => !!p.allowedValues !== !!p.numericRange, {
    message: "exactly one of allowedValues or numericRange must be set",
  });
export type ActionParameter = z.infer<typeof ActionParameterSchema>;

/**
 * Byproducts are deliberately NOT listed on the action. CONCEPT.md §9:
 * "Recipes don't exist, transformations exist" — but *which* byproducts a
 * transformation yields is a fact about the target ingredient (see
 * `producedByproducts` on `EntitySchema`), not about the verb. Peeling a
 * potato yields potato peel; peeling an apple yields apple peel — the verb
 * PEEL is identical in both cases. `spawnsTargetByproducts: true` tells the
 * engine to read the byproducts off the target entity at execution time.
 */
export const ActionOutputsSchema = z
  .object({
    /** State id the primary target transitions to, e.g. "peeled". For actions
     *  with no state-determining parameter (PEEL, WASH). */
    transformedState: z.string().optional(),
    /**
     * For a parameterized action (CUT), the resulting state instead of a
     * fixed `transformedState`: names one of this action's `parameters[].id`,
     * and the target's new state becomes whatever value was passed for that
     * parameter (e.g. shape: "diced" -> state "diced"). Mutually exclusive
     * with `transformedState`.
     */
    transformedStateFromParameter: z.string().optional(),
    /**
     * A tag id (see `EntitySchema.possibleTags`) added to the target
     * alongside its existing state, e.g. SALT adds "salted" without
     * touching whatever state the target is already in — a boiled potato
     * stays "boiled" and becomes "boiled" + tag "salted", since seasoning
     * is orthogonal to cooking method/form, unlike boiled vs. fried.
     */
    addsTag: z.string().optional(),
    /** If true, entities listed in the target's own `producedByproducts` are spawned. */
    spawnsTargetByproducts: z.boolean().default(false),
    /**
     * If true, the target instance is fully consumed and removed from the
     * simulation inventory rather than kept around in `transformedState` —
     * CLAUDE_DEV_CTX.md's conservation-of-mass rule: "separate" destroys
     * the parent egg; only the spawned children remain afterward.
     * `transformedState` may still be set alongside this — it becomes the
     * state recorded in the run log for the instance's last moment before
     * removal, not a state anything will ever observe it in afterward.
     */
    destroysTarget: z.boolean().default(false),
    /**
     * For an action that MERGES a second instance into the primary target
     * (COMBINE) rather than transforming the target alone: the entity id of
     * the brand-new resulting entity. Both the primary target and the
     * secondary instance (see ActionSchema.requiredSecondaryCapability) are
     * consumed; one new instance of this entity is spawned in their place —
     * conceptually `destroysTarget` for TWO instances at once, not one.
     * Mutually exclusive with transformedState/transformedStateFromParameter:
     * there's no "resulting state" on an instance that's being replaced by a
     * different entity entirely.
     */
    combinesInto: z.string().optional(),
  })
  .refine((o) => !(o.transformedState && o.transformedStateFromParameter), {
    message: "transformedState and transformedStateFromParameter are mutually exclusive",
  })
  .refine((o) => !(o.combinesInto && (o.transformedState || o.transformedStateFromParameter)), {
    message: "combinesInto is mutually exclusive with transformedState/transformedStateFromParameter",
  });
export type ActionOutputs = z.infer<typeof ActionOutputsSchema>;

/**
 * How a machine — not a human reading a log line — would actually confirm
 * this action's effect happened, rather than just trusting that preconditions
 * passed and a timer elapsed. `WORLD_MODEL.md`'s proposed generalization of
 * the CCP pattern (a sensor-checkable threshold over a continuous quantity)
 * to every action, not just HACCP-relevant ones. `engine.ts`'s `applyAction`
 * is open-loop today — it asserts `outputs` fired the instant preconditions
 * pass, with no feedback step. This schema does not close that loop (still
 * no real sensing/perception layer, `ENGINE_INVARIANTS.md` #11 unchanged) —
 * it records, as structured domain knowledge, WHAT a closed-loop system
 * would need to check, and how reliable that check actually is. `confidence:
 * "low"` on an action is itself useful information: it flags where this
 * model's open-loop "trust the timer" assumption is weakest, not a defect
 * to silently improve away.
 */
export const VerificationCriterionSchema = z.object({
  method: z.enum([
    "visual",
    "thermal",
    "mass_change",
    "tactile_force",
    "olfactory",
    "elapsed_time_only",
    "manual_confirmation",
  ]),
  /** What specifically to check, concrete enough to hand to a vision
   *  pipeline, a thermocouple threshold, or a human — not "check it's done". */
  description: z.string().min(1),
  /** How reliable this check actually is at confirming the effect really
   *  happened, not just that the recipe believes it should have. */
  confidence: z.enum(["high", "medium", "low"]),
});
export type VerificationCriterion = z.infer<typeof VerificationCriterionSchema>;

/**
 * Physical/operational danger from PERFORMING this action — a knife blade, a
 * hot pan, boiling liquid splatter. Deliberately separate from
 * `CriticalControlPointSchema` (thermal.ts): a CCP is about the FOOD being
 * unsafe to eat if under-processed; a hazard here is about the ACT of
 * performing the step being dangerous to a person nearby, regardless of
 * whether the food itself turns out fine. Named in the "think like a robot"
 * discussion as a real, previously-unmodeled gap (this whole codebase only
 * ever modeled food safety, never operational safety) — this is that gap
 * closed as structured data, not a control system: it does not itself keep
 * anyone safe (no proximity sensing, no interlocks — that's
 * `ENGINE_INVARIANTS.md` #11's unbuilt control/perception layer), it records
 * what a real safety system protecting a person would need to know about.
 * `type` is an open string (not a fixed enum), matching `CapabilitiesSchema`'s
 * own "keep it open" precedent — new hazard categories shouldn't need a
 * schema change to express.
 */
export const HazardSchema = z.object({
  type: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  note: z.string().min(1),
});
export type Hazard = z.infer<typeof HazardSchema>;

export const ActionSchema = z.object({
  /** Stable machine id, e.g. "peel". Referenced by EntitySchema.allowedTransformations. */
  id: z.string().min(1),
  /** Uppercase verb, per CONCEPT.md convention (PEEL, CUT, MOVE, HEAT, ...). */
  verb: z.string().min(1),
  names: z.record(z.string(), z.string()).refine((n) => "en" in n, {
    message: "names must at least include an 'en' entry",
  }),
  /**
   * Tool entity ids required to perform this action (CONCEPT.md §5/§7:
   * "PEEL requires: knife"). Cross-checked against data/entities/ at
   * validation time — every id here must resolve to an entity of kind "tool".
   */
  requiredTools: z.array(z.string()).default([]),
  /**
   * The capability flag (EntitySchema.capabilities key) a target entity must
   * assert `true` for this action to be legal against it — e.g. "isPeelable".
   * Generalizes CONCEPT.md §7's "valid targets: vegetables" into the
   * capability model already used for entities (see ingredient.ts), instead
   * of hardcoding food categories into the verb.
   *
   * A missing or `false` capability both block the action; only an explicit
   * `false` on the entity is a *permanent* denial (see ingredient.ts
   * CapabilitiesSchema doc comment) that a future capability-inference pass
   * must never override.
   */
  requiredTargetCapability: z.string().optional(),
  validTargetKinds: z.array(EntityKindSchema).default(["ingredient"]),
  /**
   * Capabilities required of some OTHER ingredient present alongside the
   * target — e.g. FRY needs a frying medium (oil, butter, ...) in addition
   * to whatever's being fried. Capability-based like requiredTargetCapability,
   * not id-based like requiredTools: any isFryingMedium ingredient will do,
   * not one specific entity. Checked for presence only (not consumed/
   * decremented) — proper ingredient consumption belongs to the full
   * recipe-level inventory in ROADMAP.md Phase 4, not this per-action check.
   */
  requiredIngredientCapabilities: z.array(z.string()).default([]),
  /**
   * The capability a SECONDARY instance must assert `true` for a COMBINE-
   * shaped action — distinct from requiredIngredientCapabilities, which only
   * ever checks presence and never consumes anything (ROADMAP.md Phase 4:
   * "only checks that a qualifying ingredient is present, not consume/
   * decrement it"). A secondary instance satisfying THIS capability is
   * consumed exactly like the primary target when outputs.combinesInto is
   * set — the caller must supply which specific instance via
   * RecipeStepSchema.secondaryInstanceId (recipe.ts) / applyAction's
   * secondaryInstance argument (engine.ts), the same way targetInstanceId
   * designates the primary target.
   */
  requiredSecondaryCapability: z.string().optional(),
  parameters: z.array(ActionParameterSchema).default([]),
  outputs: ActionOutputsSchema,
  duration: z.enum(["fixed", "variable"]).default("variable"),
  precision: z.enum(["required", "optional"]).default("optional"),
  /** How a machine would confirm this action's effect actually happened —
   *  see VerificationCriterionSchema's doc comment. Optional (existing
   *  actions predate this field), but every action added or touched from
   *  here on should carry one deliberately, not by omission. */
  verification: VerificationCriterionSchema.optional(),
  /** Physical/operational dangers from PERFORMING this action — see
   *  HazardSchema's doc comment. Empty array is a real, meaningful claim
   *  ("this action has no notable physical hazard", e.g. SALT), not just an
   *  unfilled field — audited per-action, not defaulted-and-forgotten. */
  hazards: z.array(HazardSchema).default([]),
  /**
   * Is blindly re-running this exact action (after an interruption — a
   * fault, a power loss, a human stopping and resuming) safe, or could it
   * double an effect that already happened? Two genuinely different reasons
   * an action can be `true` here, both real: (1) idempotent by construction
   * — engine.ts guards `addsTag` against duplicates (SALT/FLIP/FOLD/SHOCK/
   * INFUSE/PASTEURIZE re-running is a silent no-op, not a double effect);
   * (2) fails LOUDLY instead of silently repeating — a `destroysTarget`
   * action's target is already gone from inventory on a second attempt
   * (CRACK/SEPARATE/COMBINE), so a retry errors instead of duplicating.
   * `false` (or unset) means neither protection applies — most concretely,
   * PEEL: `spawnsTargetByproducts` fires again on an already-peeled target
   * (no state check prevents re-running it), producing a byproduct instance
   * that doesn't physically exist (you cannot peel a potato twice and get a
   * second peel). Left `undefined`, not defaulted to `false`, where genuinely
   * not yet audited — but every action in this repo has been.
   */
  retrySafe: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type Action = z.infer<typeof ActionSchema>;
````

## File: data/entities/egg.json
````json
{
  "id": "egg",
  "kind": "ingredient",
  "names": {
    "en": "Egg",
    "es": "Huevo"
  },
  "aggregationState": "solid",
  "structure": {
    "composite": false,
    "components": []
  },
  "composition": {
    "nutrientsPer100g": {
      "water_g": 76,
      "protein_g": 13,
      "fat_g": 11,
      "carbohydrate_g": 1.1
    },
    "citation": {
      "source": "USDA FoodData Central (fdc.nal.usda.gov), raw whole egg",
      "confidence": "standard_reference",
      "note": "Same caveat as potato.json/garlic.json: this repo has not looked up the exact current FDC entry to confirm the precise values against it."
    }
  },
  "possibleStates": ["raw", "boiled", "fried", "peeled", "separated", "cracked", "poached"],
  "possibleTags": ["salted", "peppered", "chili_seasoned", "pasteurized", "shocked"],
  "allowedTransformations": ["boil", "simmer", "fry", "peel", "salt", "pepper", "chili", "separate", "crack", "poach", "pasteurize", "shock"],
  "statePrerequisites": {
    "peel": "boiled",
    "shock": "boiled"
  },
  "producedByproducts": ["egg_shell"],
  "byproductsByAction": {
    "separate": ["egg_shell", "egg_yolk", "egg_white"],
    "crack": ["egg_shell", "egg_cracked"]
  },
  "criticalControlPointsByAction": {
    "fry": "egg_cooking",
    "poach": "egg_cooking",
    "boil": "egg_cooking",
    "simmer": "egg_cooking",
    "pasteurize": "egg_pasteurization_raw"
  },
  "capabilities": {
    "isBoilable": true,
    "isSimmerable": true,
    "isFryable": true,
    "isPeelable": true,
    "isSeasonable": true,
    "isSeparable": true,
    "isCrackable": true,
    "isPoachable": true,
    "isPasteurizable": true,
    "isShockable": true
  },
  "thermophysical": {
    "densityKgPerM3": 1030,
    "thermalConductivityWPerMK": 0.34,
    "citation": {
      "source": "Choi & Okos (1986) predictive food-thermal-property model — see potato.json's identical citation",
      "confidence": "standard_reference",
      "note": "Recalled as typical whole-egg literature values, not re-derived from the Choi-Okos model against egg's actual composition in this session."
    }
  },
  "sensory": {
    "taste": ["neutral"],
    "texture": ["smooth"],
    "color": "off-white"
  },
  "cooklang": {
    "canonicalToken": "huevo",
    "spiceLock": false
  },
  "metadata": {
    "notes": "Whole egg-in-shell, modeled solid like potato.json even though its contents are liquid until cracked — same 'intact object until an action changes it' convention. statePrerequisites.peel mirrors potato.json's statePrerequisites.cut: you peel a BOILED egg's shell, not a raw one, so peel presupposes state 'boiled' — reuses the existing peel action rather than inventing a new verb. thermophysical values are typical whole-egg literature approximations, not measured. producedByproducts (egg_shell) is the flat fallback both PEEL and SEPARATE would otherwise use; byproductsByAction overrides SEPARATE (adds egg_yolk + egg_white) and CRACK (adds egg_cracked instead — yolk and white kept together, see data/actions/crack.json) since both also destroysTarget. POACH deliberately does NOT go through crack/separate first — like FRY it glosses over shell removal for a raw whole egg cooked directly (see data/actions/poach.json). criticalControlPointsByAction (data/ccps/egg_cooking.json, src/thermal.ts) ties FRY/POACH/BOIL on this whole egg to the same Salmonella threshold FRY/SCRAMBLE carry on egg_cracked.json below — the risk belongs to the egg, not to whichever verb happens to cook it. Not on PEEL/SALT/SEPARATE/CRACK (no thermal step, PASTEURIZE aside).",
    "pasteurizeNote": "isPasteurizable + criticalControlPointsByAction.pasteurize (data/ccps/egg_pasteurization_raw.json, advisoryOnly: false — a hard reject, not a warning, unlike egg_cooking.json's runny-yolk case). Added for the alioli-with-egg-yolk case: any recipe using raw separated yolk (data/entities/egg_yolk.json) should pasteurize the whole egg here BEFORE separating — see data/actions/separate.json's byproduct spawning, which now inherits the 'pasteurized' tag onto egg_yolk/egg_white (engine.ts tag-propagation fix) rather than silently dropping it.",
    "shockNote": "isShockable + statePrerequisites.shock: 'boiled' — see data/actions/shock.json's carryoverCookingNote for why this matters more than it looks like it should: BOIL's durationSeconds doesn't fully determine final doneness on its own, residual heat keeps cooking the egg after it leaves the pot until this action (or slow, uncontrolled ambient cooling) stops it.",
    "seasoningNote": "pepper/chili added 2026-08-13 alongside salt — see potato.json's identical seasoningNote.",
    "simmerNote": "SIMMER (data/actions/simmer.json) added 2026-08-13, isSimmerable alongside isBoilable, reaching the SAME 'boiled' state BOIL does (see simmer.json's sharedTransformedStateNote) — statePrerequisites.peel/shock above ('boiled') therefore work unchanged for an egg cooked via SIMMER, no separate wiring needed. criticalControlPointsByAction.simmer reuses 'egg_cooking', the identical CCP boil/fry/poach already reference: Salmonella kill-time is a function of internal temperature and hold duration, not of how turbulently the water moved to get there. The real reason this verb exists for egg specifically: a rolling boil's turbulence is a common, preventable CAUSE of shell cracking during cooking — see crackContainmentNote below for what to do once a crack has already happened; this is the complementary, more-preventable half of the same real risk.",
    "crackContainmentNote": "Real, commonly-cited technique — salt (or vinegar) added to the BOILING WATER before/while boiling an egg, distinct from and NOT modeled via data/actions/salt.json's SALT verb, on purpose: SALT targets a food entity and adds tag 'salted' for a seasoning/flavor reason (osmosis, browning — see salt.json's timingNote); salting the water an egg boils in is NOT primarily about flavor at all — the shell/white barely absorb it during a ~10 minute boil, unlike a porous food like pasta. The real, causal mechanism is different: if the shell cracks during boiling, salt (and separately, vinegar/acid) speeds coagulation of the leaking egg white on contact with the salted water, sealing the crack faster and containing the mess, rather than letting white stream out into plain water. A commonly-repeated SECOND claim — that salting the water makes peeling easier — is NOT included here with the same confidence: evidence for it is mixed/disputed; easier peeling is more reliably explained by egg freshness (older eggs peel easier as the shell's inner membrane separates more with age/CO2 loss) and by shock.json's ice-bath shock, not by water salinity. Deliberately not built as a new action/mechanism this session (would need water.json to accept an additive for a non-seasoning, non-isSeasonable reason — a genuinely different concept SALT's isSeasonable/isSeasoning capabilities don't fit) — named precisely as a real, correctly out-of-scope gap rather than forced into the wrong verb just to have something."
  }
}
````

## File: scripts/validate.ts
````typescript
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EntitySchema, type Entity } from "../src/ingredient.ts";
import { ActionSchema, type Action } from "../src/action.ts";
import { RecipeScriptSchema, type RecipeScript } from "../src/recipe.ts";
import { CriticalControlPointSchema, type CriticalControlPoint } from "../src/thermal.ts";
import { HeatSourceProfileSchema, type HeatSourceProfile } from "../src/heat-source.ts";

const root = join(import.meta.dirname, "..");

function loadDir<T extends { id: string }>(
  dir: string,
  label: string,
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }
) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const items = new Map<string, T>();
  let failed = 0;
  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const result = schema.safeParse(raw);
    if (result.success) {
      console.log(`OK   ${label}/${file}  (id: ${result.data.id})`);
      items.set(result.data.id, result.data);
    } else {
      failed++;
      console.error(`FAIL ${label}/${file}`);
      for (const issue of result.error.issues) {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      }
    }
  }
  return { items, failed, total: files.length };
}

const entities = loadDir<Entity>(join(root, "data", "entities"), "entities", EntitySchema);
const actions = loadDir<Action>(join(root, "data", "actions"), "actions", ActionSchema);
const recipes = loadDir<RecipeScript>(join(root, "data", "recipes"), "recipes", RecipeScriptSchema);
const ccps = loadDir<CriticalControlPoint>(join(root, "data", "ccps"), "ccps", CriticalControlPointSchema);
const heatSources = loadDir<HeatSourceProfile>(join(root, "data", "heat-sources"), "heat-sources", HeatSourceProfileSchema);

let crossFailed = 0;
function fail(msg: string) {
  crossFailed++;
  console.error(`FAIL ${msg}`);
}

for (const entity of entities.items.values()) {
  for (const byproductId of entity.producedByproducts) {
    if (!entities.items.has(byproductId)) {
      fail(`entities/${entity.id}.json: producedByproducts references unknown entity "${byproductId}"`);
    }
  }
  for (const actionId of entity.allowedTransformations) {
    const action = actions.items.get(actionId);
    if (!action) {
      fail(`entities/${entity.id}.json: allowedTransformations references unknown action "${actionId}"`);
      continue;
    }
    // outputs.addsTag is applied by engine.ts unconditionally (never
    // checked against the target's own possibleTags — only byproduct/
    // combinesInto tag INHERITANCE is filtered that way, see engine.ts's
    // doc comment) — so this can't be a hard fail without risking a false
    // positive against that real asymmetry. Still worth a NOTE: an entity
    // that allows an addsTag-shaped action but never lists the resulting
    // tag in its own possibleTags is very likely an oversight, the same
    // shape of gap salt/pepper/chili's possibleTags wiring was checked for
    // by hand 2026-08-13 — this makes that check permanent instead of
    // relying on remembering to do it again next time a seasoning verb
    // (or any other addsTag action) is added to a new entity.
    if (action.outputs.addsTag && !entity.possibleTags.includes(action.outputs.addsTag)) {
      console.log(
        `NOTE entities/${entity.id}.json: allows "${actionId}" (which adds tag "${action.outputs.addsTag}") but doesn't list "${action.outputs.addsTag}" in possibleTags.`
      );
    }
  }
  for (const [actionId, byproductIds] of Object.entries(entity.byproductsByAction)) {
    if (!actions.items.has(actionId)) {
      fail(`entities/${entity.id}.json: byproductsByAction references unknown action "${actionId}"`);
    }
    for (const byproductId of byproductIds) {
      if (!entities.items.has(byproductId)) {
        fail(`entities/${entity.id}.json: byproductsByAction["${actionId}"] references unknown entity "${byproductId}"`);
      }
    }
  }
  for (const [actionId, ccpId] of Object.entries(entity.criticalControlPointsByAction)) {
    if (!actions.items.has(actionId)) {
      fail(`entities/${entity.id}.json: criticalControlPointsByAction references unknown action "${actionId}"`);
    }
    if (!ccps.items.has(ccpId)) {
      fail(`entities/${entity.id}.json: criticalControlPointsByAction["${actionId}"] references unknown CCP "${ccpId}"`);
    }
  }
  // Soft prompts, not failures — both found real gaps by being asked
  // explicitly (tortilla_mixture.json had a cooking capability and zero CCP
  // wiring until asked about tortilla de Betanzos; several entities had
  // composition/thermophysical numbers with no citation until asked to be
  // "ready to publish"). A NOTE here doesn't mean something is wrong — e.g.
  // potato/garlic correctly have no CCP — it means a human should confirm
  // that's deliberate, not silently unaudited.
  const cookingCapabilities = ["isFryable", "isBoilable", "isPoachable", "isScramblable"] as const;
  const hasCookingCapability = cookingCapabilities.some((c) => entity.capabilities[c]);
  if (hasCookingCapability && Object.keys(entity.criticalControlPointsByAction).length === 0) {
    console.log(`NOTE entities/${entity.id}.json: has a cooking capability but no criticalControlPointsByAction — confirm this is deliberate (no pathogen risk), not unaudited.`);
  }
  if (entity.composition?.nutrientsPer100g && !entity.composition.citation) {
    console.log(`NOTE entities/${entity.id}.json: composition.nutrientsPer100g has no citation.`);
  }
  if (entity.thermophysical && Object.keys(entity.thermophysical).some((k) => k !== "citation") && !entity.thermophysical.citation) {
    console.log(`NOTE entities/${entity.id}.json: thermophysical has no citation.`);
  }
}

for (const action of actions.items.values()) {
  for (const toolId of action.requiredTools) {
    const tool = entities.items.get(toolId);
    if (!tool) {
      fail(`actions/${action.id}.json: requiredTools references unknown entity "${toolId}"`);
    } else if (tool.kind !== "tool") {
      fail(`actions/${action.id}.json: requiredTools references "${toolId}" which is kind "${tool.kind}", not "tool"`);
    }
  }
  if (action.outputs.combinesInto && !entities.items.has(action.outputs.combinesInto)) {
    fail(`actions/${action.id}.json: outputs.combinesInto references unknown entity "${action.outputs.combinesInto}"`);
  }
  if (!action.verification) {
    console.log(`NOTE actions/${action.id}.json: no verification criterion — how would a machine confirm this action's effect happened?`);
  }
  if (action.retrySafe === undefined) {
    console.log(`NOTE actions/${action.id}.json: retrySafe not audited — is blindly re-running this after an interruption safe?`);
  }
}

for (const recipe of recipes.items.values()) {
  const knownInstanceIds = new Set(recipe.initialInventory.map((i) => i.id));
  const knownEntityIds = new Set(recipe.initialInventory.map((i) => i.entityId));
  for (const item of recipe.initialInventory) {
    if (!entities.items.has(item.entityId)) {
      fail(`recipes/${recipe.id}.json: initialInventory references unknown entity "${item.entityId}"`);
    }
    // A "relative" quantity (e.g. baker's-percentage salt) is meaningless
    // without the entity it's a ratio OF actually being present in the
    // same recipe — unlike targetInstanceId/secondaryInstanceId below,
    // this checks against entityId (a recipe-wide ingredient), not a
    // specific instance id, so it can be a hard fail rather than a NOTE:
    // there's no "assumed to be spawned later" escape hatch for an entity
    // that was never in this recipe at all.
    if (item.quantity?.kind === "relative" && !knownEntityIds.has(item.quantity.ofEntityId)) {
      fail(
        `recipes/${recipe.id}.json: initialInventory["${item.id}"].quantity.ofEntityId references entity "${item.quantity.ofEntityId}", which isn't used anywhere in this recipe's initialInventory`
      );
    }
  }
  for (const toolId of recipe.availableTools) {
    const tool = entities.items.get(toolId);
    if (!tool) {
      fail(`recipes/${recipe.id}.json: availableTools references unknown entity "${toolId}"`);
    } else if (tool.kind !== "tool") {
      fail(`recipes/${recipe.id}.json: availableTools references "${toolId}" which is kind "${tool.kind}", not "tool"`);
    }
  }
  for (const [i, step] of recipe.sequence.entries()) {
    if (!actions.items.has(step.actionId)) {
      fail(`recipes/${recipe.id}.json: sequence[${i}] references unknown action "${step.actionId}"`);
    }
    // Only checks against initialInventory ids, not ids a prior step might
    // spawn (e.g. potato_peel-1) — runner.ts assigns those at run time, so
    // a step correctly targeting a spawned instance can't be verified
    // statically here without simulating the whole run.
    if (!knownInstanceIds.has(step.targetInstanceId)) {
      console.log(
        `NOTE recipes/${recipe.id}.json: sequence[${i}].targetInstanceId "${step.targetInstanceId}" isn't in initialInventory — assumed to be a spawned instance, not checked further.`
      );
    }
    if (step.secondaryInstanceId && !knownInstanceIds.has(step.secondaryInstanceId)) {
      console.log(
        `NOTE recipes/${recipe.id}.json: sequence[${i}].secondaryInstanceId "${step.secondaryInstanceId}" isn't in initialInventory — assumed to be a spawned instance, not checked further.`
      );
    }
  }
}

const failed = entities.failed + actions.failed + recipes.failed + ccps.failed + heatSources.failed + crossFailed;
const total = entities.total + actions.total + recipes.total + ccps.total + heatSources.total;
if (failed > 0) {
  console.error(`\n${failed} problem(s) found.`);
  process.exit(1);
}
console.log(
  `\nAll ${total} files valid (${entities.total} entities, ${actions.total} actions, ${recipes.total} recipes, ${ccps.total} ccps, ${heatSources.total} heat-sources); cross-references OK.`
);
````

## File: data/entities/potato.json
````json
{
  "id": "potato",
  "kind": "ingredient",
  "names": {
    "en": "Potato",
    "es": "Patata"
  },
  "aggregationState": "solid",
  "structure": {
    "composite": false,
    "components": []
  },
  "composition": {
    "nutrientsPer100g": {
      "water_g": 79,
      "carbohydrate_g": 17
    },
    "citation": {
      "source": "USDA FoodData Central (fdc.nal.usda.gov), raw potato, flesh and skin",
      "confidence": "standard_reference",
      "note": "Figures are in the range USDA FoodData Central publishes for raw potato — this repo has not looked up the exact current FDC entry/ID to confirm the precise values, and potato composition genuinely varies by cultivar (see garlic.json's cultivar note for the same caveat on a different crop)."
    }
  },
  "possibleStates": ["raw", "washed", "peeled", "sliced", "diced", "julienne", "chopped", "minced", "boiled", "fried", "baked", "mashed"],
  "possibleTags": ["salted", "peppered", "chili_seasoned"],
  "allowedTransformations": ["wash", "peel", "cut", "boil", "simmer", "fry", "bake", "salt", "pepper", "chili", "combine"],
  "statePrerequisites": {
    "cut": "peeled",
    "combine": "fried"
  },
  "producedByproducts": ["potato_peel"],
  "capabilities": {
    "isPeelable": true,
    "isChoppable": true,
    "isBoilable": true,
    "isSimmerable": true,
    "isFryable": true,
    "isBakeable": true,
    "isWashable": true,
    "isSeasonable": true,
    "isCombinableBase": true
  },
  "thermophysical": {
    "densityKgPerM3": 1080,
    "thermalConductivityWPerMK": 0.5,
    "citation": {
      "source": "Choi & Okos (1986), \"Effects of Temperature and Composition on the Thermal Properties of Foods\" — the standard predictive model in food engineering for deriving thermal conductivity/density/specific heat from a food's composition",
      "confidence": "standard_reference",
      "note": "This repo has not run potato's actual composition through the Choi-Okos model to re-derive these numbers — they're recalled as being in the right range for a starchy tuber, not computed from it here."
    }
  },
  "sensory": {
    "taste": ["neutral"],
    "texture": ["firm", "starchy"],
    "color": "brown"
  },
  "cooklang": {
    "canonicalToken": "patata",
    "spiceLock": false
  },
  "metadata": {
    "notes": "possibleStates/capabilities grounded in CLAUDE_DEV_CTX.md's own potato examples ('cannot peel a potato that is already boiled', INVALID_TRANSITIONS: boiled/fried/mashed). statePrerequisites.cut records that a recipe just saying 'cut the potato' implies peeling first. boil/fry/bake are three distinct verbs on purpose: cooked in water vs. oil vs. dry heat give different results, so they're not collapsed into one generic COOK verb. mash isn't wired up yet (no 'mash' action exists) even though 'mashed' remains a listed state. possibleTags/salt: seasoning is orthogonal to possibleStates — a 'salted boiled potato' is state 'boiled' plus tag 'salted' held at once, not a single combined state.",
    "combineNote": "isCombinableBase + statePrerequisites.combine: 'fried' — tortilla de patatas combines already-fried potato with beaten egg, not raw. See data/actions/combine.json and data/entities/tortilla_mixture.json (the first entity in this repo to actually use structure.composite/components).",
    "seasoningNote": "pepper/chili added to allowedTransformations 2026-08-13 alongside salt, the first entity to use all three seasoning verbs (data/actions/pepper.json, chili.json) — same addsTag/possibleTags mechanism as salt, no recipe currently exercises them (built to make the vocabulary capable, not forced into an existing dish that wasn't asked to have pepper/chili).",
    "simmerNote": "SIMMER (data/actions/simmer.json) added 2026-08-13, isSimmerable alongside isBoilable — reaches the SAME 'boiled' state as BOIL, deliberately (see simmer.json's sharedTransformedStateNote), just via a gentler, lower-turbulence process real technique actually recommends for whole/halved potatoes to avoid broken skins and starch-clouded water. No recipe currently exercises it (same 'capable, not forced in' discipline as pepper/chili above)."
  }
}
````

## File: src/ingredient.ts
````typescript
import { z } from "zod";

/**
 * Entity & Ingestion Models — Roadmap Phase 1 (see ROADMAP.md).
 *
 * This file currently defines only `EntitySchema` and its supporting
 * sub-schemas: the "Knowledge" layer for a single canonical ingredient/tool
 * (CONCEPT.md §3, §6 — "Knowledge is immutable"). `RecipeIngredientSchema`
 * (instance portions inside a specific recipe) and `ParsedIngredientSchema`
 * (staging shape for raw scraper output) are separate, later concerns per
 * CLAUDE_DEV_CTX.md and are not needed to express a standalone entity like
 * salt — they're not implemented here yet.
 */

/** Ingredients and tools are both Entities, but never conflated (CLAUDE_DEV_CTX.md). */
export const EntityKindSchema = z.enum(["ingredient", "tool"]);
export type EntityKind = z.infer<typeof EntityKindSchema>;

/** Physical state of matter (Culinary_Informatics_Research_Plan.pdf §2, "estado de agregación"). */
export const AggregationStateSchema = z.enum([
  "solid",
  "liquid",
  "gas",
  "powder",
  "granular",
  "paste",
  "emulsion",
]);
export type AggregationState = z.infer<typeof AggregationStateSchema>;

/**
 * Whether this entity is built from other entities, or atomic.
 * masideas.md §6 "Structure" — most base ingredients (salt, water) are
 * non-composite; assembled foods (a sandwich) would set composite: true.
 */
export const StructureSchema = z
  .object({
    composite: z.boolean().default(false),
    components: z.array(z.string()).default([]), // entity ids, when composite
  })
  .default({ composite: false, components: [] });
export type Structure = z.infer<typeof StructureSchema>;

/**
 * A citation for a numeric claim — replaces burying "commonly cited,
 * unverified" hedges inconsistently in prose (found 2026-08-12: `egg.json`/
 * `garlic.json` got that hedge, `potato.json`/`salt.json`/`water.json`/
 * `oil.json`/`egg_yolk.json`/`egg_white.json`/`egg_cracked.json` didn't, for
 * numbers with the exact same epistemic status — inconsistently applied
 * rigor, not consistently absent rigor).
 *
 * `confidence` is deliberately two-valued, not three: this repo has no live
 * retrieval capability, so nothing here has ever been checked against a
 * primary source directly — there is no honest "primary_source" tier to
 * offer. `standard_reference` means a specific, real, canonical work for
 * this class of fact is named (USDA FoodData Central, the CRC Handbook of
 * Chemistry and Physics, a named paper) — checkable by a reader, not
 * independently verified by this repo. `commonly_cited_unverified` means
 * recalled as generally taught/published but without confidence in which
 * specific canonical source it traces to. Neither is a substitute for actual
 * primary-source verification before any real-world/production use.
 */
export const CitationSchema = z.object({
  source: z.string().min(1),
  confidence: z.enum(["standard_reference", "commonly_cited_unverified"]),
  note: z.string().optional(),
});
export type Citation = z.infer<typeof CitationSchema>;

/** Chemical/nutritional composition. masideas.md §6 "Composition". */
export const CompositionSchema = z
  .object({
    chemicalFormula: z.string().optional(),
    /** Nutrient amount per 100g of entity, keyed by nutrient id (e.g. "sodium_mg"). */
    nutrientsPer100g: z.record(z.string(), z.number()).optional(),
    citation: CitationSchema.optional(),
  })
  .partial();
export type Composition = z.infer<typeof CompositionSchema>;

/**
 * Thermophysical properties driving thermal simulation
 * (Culinary_Informatics_Research_Plan.pdf §2: thermal conductivity, density, ...).
 */
export const ThermophysicalPropertiesSchema = z
  .object({
    thermalConductivityWPerMK: z.number().nonnegative(),
    densityKgPerM3: z.number().positive(),
    specificHeatJPerKgK: z.number().positive(),
    meltingPointC: z.number(),
    boilingPointC: z.number(),
    citation: CitationSchema.optional(),
  })
  .partial();
export type ThermophysicalProperties = z.infer<typeof ThermophysicalPropertiesSchema>;

/** masideas.md §6 "Sensory Properties". */
export const SensoryPropertiesSchema = z
  .object({
    /**
     * "pungent" closed 2026-08-13 — flagged as a real gap in garlic.json's
     * own flavorChemistryNote before it blocked anything: the five basic
     * tastes (salty/sweet/sour/bitter/umami) don't include the trigeminal/
     * chemesthetic "heat" sensation (capsaicin in chili, piperine in black
     * pepper, allicin in garlic) — a real, distinct sensory channel (pain/
     * temperature nerve fibers, not taste buds), not a degree of
     * bitterness. Kept as one added enum value rather than a separate
     * schema field: still just "how does this register on the tongue/in
     * the mouth," the same question every other taste value answers.
     */
    taste: z.array(
      z.enum(["salty", "sweet", "sour", "bitter", "umami", "pungent", "neutral"])
    ),
    aroma: z.array(z.string()),
    texture: z.array(z.string()),
    color: z.string(),
  })
  .partial();
export type SensoryProperties = z.infer<typeof SensoryPropertiesSchema>;

/**
 * Mechanical capability flags.
 *
 * `.catchall(z.boolean())` deliberately keeps this map open: an unrecognized
 * capability key must still parse rather than fail validation, per
 * CONCEPT.md §15 "Unknown Knowledge" / the PDF §4 dynamic capability
 * inference example (isPeelable/isChoppable/isFryable inferred at runtime
 * for an ingredient outside the canonical dictionary).
 */
export const CapabilitiesSchema = z
  .object({
    isPeelable: z.boolean(),
    isChoppable: z.boolean(),
    isFryable: z.boolean(),
    isBoilable: z.boolean(),
    isDissolvable: z.boolean(),
    isSeasoning: z.boolean(),
    isWashable: z.boolean(),
    isBlendable: z.boolean(),
    isFryingMedium: z.boolean(),
    isBakeable: z.boolean(),
    isBoilingMedium: z.boolean(),
    /** Can receive a seasoning (as opposed to isSeasoning: *is* a seasoning). */
    isSeasonable: z.boolean(),
  })
  .partial()
  .catchall(z.boolean());
export type Capabilities = z.infer<typeof CapabilitiesSchema>;

/**
 * Cooklang interop (CLAUDE_DEV_CTX.md: "maintain full backward-compatibility
 * with custom scaling rules ... and spice locks").
 */
export const CooklangInteropSchema = z.object({
  /** The bare token used after `@` in .cook files, e.g. "sal" for `@sal`. */
  canonicalToken: z.string(),
  /**
   * True for `=`-prefixed quantities in Cooklang: this entity's amount does
   * NOT scale linearly when a recipe is scaled (the canonical example is salt).
   */
  spiceLock: z.boolean().default(false),
});
export type CooklangInterop = z.infer<typeof CooklangInteropSchema>;

/**
 * How much of an ingredient instance is actually present/used —
 * ROADMAP.md Phase 1's `RecipeIngredientSchema`, closed 2026-08-13 (used as
 * `RecipeInstanceSchema.quantity`, recipe.ts, not on `EntitySchema` itself:
 * an amount is a fact about one recipe's USE of an ingredient, not about the
 * ingredient's own immutable knowledge — same reasoning `EntitySchema`
 * elsewhere applies to state/tags never living on the entity).
 *
 * Three genuinely different KINDS, not one fuzzy `amount` field, because
 * real recipes use different KINDS of quantity, not just different units of
 * the same kind — collapsing them into one number would misrepresent
 * whichever ones don't actually work that way:
 *
 * - `"precise"`: a real measured amount + unit (5g, 200ml, 2 count). The
 *   ordinary case for most ingredients.
 * - `"imprecise"`: a real, commonly-used culinary quantity descriptor that
 *   is NOT reducible to a precise number by convention — "a pinch," "a
 *   dash," "to taste." Cooks genuinely do not measure these; forcing a fake
 *   gram value here would misrepresent how the quantity is actually used —
 *   the same "don't imply more precision than was verified" standard this
 *   repo already holds citations to (`CitationSchema` above).
 *   `approxRangeGrams` is optional, explicitly non-authoritative reference
 *   context for a human (or a future planner), never consumed by
 *   engine.ts. It's also inherently imprecise for a SECOND reason, not just
 *   "pinches aren't measured": how much salt a pinch actually is depends on
 *   crystal size/shape (fine table salt vs. flaky sea salt vs. coarse
 *   kosher packs very differently by volume) — a gap this repo doesn't
 *   model at all yet (no separate entities for salt by crystal size), so
 *   `approxRangeGrams` should be read as "commonly cited for ordinary table
 *   salt," not a figure this schema can actually guarantee.
 * - `"relative"`: a real, PRECISE, but ratio-based quantity — the amount is
 *   defined as a percentage of some OTHER ingredient's mass/count, not an
 *   absolute number. The canonical case: professional bread salt, dosed at
 *   ~1.8-2.2% of flour weight (a real "baker's percentage"), not "a pinch."
 *   Answers "compared to what?" directly for the cases where a quantity
 *   really is relative, instead of collapsing it into a precise-but-wrong
 *   absolute number the way a single `amount` field would.
 *
 * Deliberately NOT wired into engine.ts/recipe-runner.ts's execution path:
 * ingredients are still never consumed/decremented (engine.ts's own doc
 * comment; LEARNINGS.md 2026-08-12) — this records how much of an instance
 * exists/was used, for a human or a future real inventory system to read;
 * it does not make `applyAction` quantity-aware. Also not wired to any
 * recipe-scaling engine: `CooklangInteropSchema.spiceLock` above already
 * flags "this entity's amount doesn't scale linearly" at the entity level,
 * but no scaling-multiplier feature exists anywhere in this repo to scale
 * AGAINST — `spiceLock` stays exactly as informational as it always was;
 * this schema doesn't change that, it only answers "how much right now,"
 * not "how much if this recipe were doubled."
 */
export const QuantitySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("precise"),
    amount: z.number().positive(),
    unit: z.enum(["g", "kg", "ml", "l", "tsp", "tbsp", "cup", "count"]),
  }),
  z.object({
    kind: z.literal("imprecise"),
    descriptor: z.enum(["pinch", "dash", "handful", "splash", "to_taste"]),
    /** Non-authoritative reference range only — see the doc comment above
     *  for why this can't be treated as a real measurement. */
    approxRangeGrams: z
      .object({ min: z.number().positive(), max: z.number().positive() })
      .optional(),
    citation: CitationSchema.optional(),
    note: z.string().optional(),
  }),
  z.object({
    kind: z.literal("relative"),
    /** e.g. 0.02 for a 2% baker's percentage. */
    ratio: z.number().positive(),
    /** The entity id this ratio is computed against, e.g. "flour" — must be
     *  another instance's entityId present in the same recipe's
     *  initialInventory (scripts/validate.ts cross-checks this; engine.ts
     *  does not compute an absolute amount from it). */
    ofEntityId: z.string().min(1),
    basis: z.enum(["mass", "count"]).default("mass"),
    note: z.string().optional(),
  }),
]);
export type Quantity = z.infer<typeof QuantitySchema>;

/**
 * EntitySchema — validates a static entity (CLAUDE_DEV_CTX.md).
 * One JSON file per entity under `data/entities/*.json`.
 */
export const EntitySchema = z.object({
  /** Stable machine id, e.g. "salt". Used as the join key everywhere else
   *  (recipe-step.ts inputs/outputs, INVALID_TRANSITIONS, etc.). */
  id: z.string().min(1),
  kind: EntityKindSchema,
  /** locale -> display name, e.g. { en: "Salt", es: "Sal" }. */
  names: z.record(z.string(), z.string()).refine((n) => "en" in n, {
    message: "names must at least include an 'en' entry",
  }),
  aggregationState: AggregationStateSchema,
  structure: StructureSchema,
  composition: CompositionSchema.optional(),
  /** State ids this entity can be found in (CONCEPT.md §8). Mutually
   *  exclusive at any moment — an instance has exactly one. */
  possibleStates: z.array(z.string()).default([]),
  /**
   * Tag ids this entity can carry, orthogonal to `possibleStates` — an
   * instance can have any number of these at once, alongside its one state.
   * Needed because not every property is exclusive: a potato can be
   * "boiled" (state) AND "salted" (tag) simultaneously, unlike "boiled" vs
   * "fried" which really are exclusive. See ActionOutputsSchema.addsTag.
   */
  possibleTags: z.array(z.string()).default([]),
  /** Action ids that may legally target this entity. */
  allowedTransformations: z.array(z.string()).default([]),
  /**
   * Per-action state preconditions: action id -> the state this entity must
   * already be in before that action may run, e.g. { "cut": "peeled" } —
   * "cutting a potato presupposes it's already peeled." Lives on the entity
   * rather than on the generic CUT verb because the precondition is a fact
   * about *this* ingredient, not about cutting in general (not everything
   * CUT can target needs peeling first).
   */
  statePrerequisites: z.record(z.string(), z.string()).default({}),
  /**
   * Entity ids this entity may spawn when consumed (CONCEPT.md §9). This is
   * the fallback list any `spawnsTargetByproducts` action uses when it has
   * no more specific entry in `byproductsByAction` below — correct as long
   * as an entity has at most one action that spawns byproducts (e.g.
   * potato.json + peel -> potato_peel).
   */
  producedByproducts: z.array(z.string()).default([]),
  /**
   * Per-action override of `producedByproducts`, keyed by action id, for an
   * entity with more than one `spawnsTargetByproducts` action that don't
   * yield the same things — e.g. egg.json: PEEL (a boiled egg's shell)
   * should spawn only egg_shell, while SEPARATE (cracking a raw egg) spawns
   * egg_shell + egg_yolk + egg_white. Without this, both actions would
   * spawn the full flat `producedByproducts` list, which is wrong for PEEL.
   * An action id absent here falls back to the flat list.
   */
  byproductsByAction: z.record(z.string(), z.array(z.string())).default({}),
  /**
   * Per-action HACCP tie-in, keyed by action id -> CriticalControlPointSchema
   * id (thermal.ts, data/ccps/*.json) — e.g. egg.json: { fry: "egg_cooking",
   * scramble: "egg_cooking", poach: "egg_cooking" }. Lives on the entity,
   * not the action, for the same reason byproductsByAction does: FRY itself
   * carries no food-safety risk (frying a potato has no Salmonella CCP) —
   * the risk is a fact about *what's* being fried, not the verb.
   */
  criticalControlPointsByAction: z.record(z.string(), z.string()).default({}),
  capabilities: CapabilitiesSchema.default({}),
  thermophysical: ThermophysicalPropertiesSchema.optional(),
  sensory: SensoryPropertiesSchema.optional(),
  cooklang: CooklangInteropSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type Entity = z.infer<typeof EntitySchema>;
````

## File: LEARNINGS.md
````markdown
# LEARNINGS.md

A dated, append-only log of concrete things learned while building this engine —
patterns, gotchas, and *why* a design choice was made, not a changelog of *what*
files changed (that's `git log`). Read this before starting new work in this repo;
append a new dated entry when you learn something that would've saved you time if
you'd known it going in. Don't rewrite or delete old entries — append.

---

## 2026-08-12

### Schema/engine constraints that shape everything downstream

- **`ActionOutputsSchema` supports exactly one of `transformedState` (fixed) or
  `transformedStateFromParameter` (fully parameter-driven) — never "fixed by
  default, overridable per call."** This blocked giving garlic's FRY a real
  `"browned"` state without breaking every potato/egg caller that doesn't pass a
  doneness param (`transformedStateFromParameter` throws if its param is
  missing, `required: false` or not). Resolution used twice: keep the nuance as
  an **informational, non-state-determining parameter** instead of inventing a
  default-value mechanism. The alternative — splitting a dedicated verb, the way
  `SCRAMBLE` was split from `FRY` and `POACH` from `BOIL` — is the other valid
  escape hatch when the outcome genuinely differs enough to earn its own verb.
- **`requiredIngredientCapabilities` checks presence via the ingredient's
  *entity* definition only — never the ingredient *instance's* current
  state.** A whole raw garlic clove and knife-minced garlic both satisfy
  `isAromaticSource` identically. Real technique cares about surface area /
  rupture; the engine can't currently express that. Flagged in `infuse.json` as
  a known, pre-existing gap, not something new.
- **`byproductsByAction` (entity-level, keyed by action id) exists because a flat
  `producedByproducts` list breaks the moment one entity has *two* different
  `spawnsTargetByproducts` actions with different outputs** (egg: `PEEL` → shell
  only, `SEPARATE`/`CRACK` → shell + yolk/white or shell + cracked). Any new
  entity with more than one spawning action needs this, not the flat list.
- **`destroysTarget` actions still populate `ExecutionResult.instance`** — it's
  the target's state the instant before removal, kept for logging. The caller
  (`recipe-runner.ts`) must `inventory.delete(...)`, not `inventory.set(...)`,
  when `result.destroyed` is true. A demo script bug (`cook-egg-many-ways.ts`
  first draft) chained off `.instance` after `CRACK` instead of `.spawned` —
  caught by actually running the script, not by reading the code.

### HACCP / safety modeling

- **`CriticalControlPointSchema` is shaped for cook-time temperature/hold-time
  thresholds. It does NOT fit storage-duration hazards** (garlic-in-oil
  botulism is a post-preparation refrigeration/acidification concern, not
  something any cooking step's heat controls). Forcing a hazard into a schema
  built for a different-shaped problem would misrepresent it — correctly
  identifying "this doesn't fit, here's why" is itself the rigorous move, not a
  gap to paper over. See `infuse.json`'s `safetyNote`.
- **The CCP existence check must be gated on the triggering parameter
  (`durationSeconds`) actually being supplied — not merely on the target
  entity having a `criticalControlPointsByAction` entry.** First draft threw
  `"references unknown CriticalControlPoint"` on *every* egg fry/poach that
  didn't pass a duration, because the check ran unconditionally once the entity
  declared a CCP for that action. Caught by full regression, not by review.
- **"Same API" (CONCEPT.md §17: a robot drives the same event timeline a human
  would) does not mean "same default judgment call."** An `advisoryOnly` CCP
  shortfall that a human can read and accept for themselves (a runny yolk) has
  no one to make that call under autonomous execution — the safe default has to
  flip to reject, not stay permissive, unless a human explicitly pre-authorized
  that specific CCP id in advance. This is `engine.ts`'s `SafetyPolicy` and
  `ENGINE_INVARIANTS.md` #11.
- **Every categorical "informational only" parameter accumulated so far**
  (`heatLevel`, `doneness`, `oilAdditionRate`, `curdSize`, `agitation`,
  `waterTempC`) **is a human-readable technique hint with no defined mapping to
  an actual robot actuator command.** `SafetyPolicy` only closes the HACCP-timing
  gap for autonomous execution — it does not make the rest of the engine
  robot-ready. Saying this explicitly beats letting "autonomous mode exists
  now" imply more capability than exists.

### Recipe-level patterns

- **A finished "dish" (alioli, salted fried potatoes) is represented by a
  `RecipeScript`'s own `names` field, not a new composite entity** —
  `EntitySchema.structure.composite/components` exists but nothing populates it
  yet. Assembling multiple finished instances into one composite dish (a salad
  from reused fried garlic + other components) is a genuinely unbuilt feature
  (no `ASSEMBLE`-style verb, no merge-instances mechanic) — flagged as an open
  extension in `garlic-oil-potatoes.json` rather than faked with a hollow
  composite entity that's really just one ingredient under a new id.
- **Ingredients are never consumed/decremented by `requiredIngredientCapabilities`
  checks — only checked for presence.** This is a documented limitation
  (`engine.ts`'s own doc comment), but it's also what makes "the same oil
  instance flavors garlic, then fries a potato two steps later" work for free —
  a limitation and a convenience at the same time, worth knowing both sides of.
- **Two recipes meant to be compared side-by-side** (`handmade-alioli.json` vs.
  `handmade-alioli-egg-yolk.json`) **should share every step up to the point
  they actually diverge, using identical parameter ids/units so the diff is
  literal, not narrated.** Cross-reference both directions in `metadata` since
  `RecipeScriptSchema` has no formal "variant of" field.

### Process

- **After any `engine.ts`/schema change: re-run every existing demo script +
  every recipe + `tsc -p . --noEmit`, not just the new thing.** Caught two real
  regressions this session this way (the `CRACK`/`.spawned` bug, the CCP-gating
  bug) that a narrower check would have missed.
- **`tsc` reports pre-existing `TS5097` (import-extension) errors across nearly
  every file in this repo, unrelated to any change made here.** Filter with
  `grep -v TS5097` when checking for *new* type errors, or the noise drowns
  the signal.
- **Cite sources for numeric claims that could be quietly wrong** (USDA/FDA
  URLs and section numbers in `data/ccps/egg_cooking.json`, not just a bare
  number) — and state explicitly when a figure is a simplification of a richer
  real table (the Food Code's actual multi-point curve vs. this schema's
  two-point model), rather than implying more precision than was verified.
- **"Can the vocabulary make dish X end-to-end" is a better progress signal than
  phase checkboxes, and it's empirically checkable — write the attempt as a
  script, run it, let it fail where it actually fails.** `attempt-tortilla.ts`
  proved two real, previously-only-implicit gaps this way: no verb combines two
  separate instances into one (blocks potato+egg → tortilla mixture, same root
  cause as the earlier "salad" gap in `garlic-oil-potatoes.json` — this is now
  the third time it's blocked a real recipe, promoted to the top of
  `ROADMAP.md` Phase 4 because of that), and no `FLIP` verb exists at all for
  the single most technique-defining step of the dish. Neither gap is about
  robot control/perception (`ENGINE_INVARIANTS.md` #11) — the vocabulary itself
  stops short before physical execution is even the question. Worth
  re-attempting a new real dish periodically specifically to surface the next
  missing verb, rather than guessing at what to build speculatively.
- **Both gaps above are now closed — `COMBINE` needed a genuine new engine
  mechanism, `FLIP` didn't.** `FLIP` fit the existing single-target action
  shape exactly (`addsTag`, same as `SALT`) — no schema/engine change at all,
  pure data. `COMBINE` couldn't: `applyAction` only ever took one target
  instance, and every existing "second ingredient" mechanism
  (`requiredIngredientCapabilities`) explicitly only checks *presence*, never
  consumes anything (that limitation is stated in `ROADMAP.md` Phase 4 itself).
  Merging two real instances into a new one needed: a second required-capability
  slot on the action (`requiredSecondaryCapability`, distinct from
  `requiredIngredientCapabilities` on purpose — presence-check vs.
  consume-and-replace are genuinely different operations, not degrees of the
  same one), a new output shape (`combinesInto`, mutually exclusive with
  `transformedState`/`transformedStateFromParameter` — there's no "resulting
  state" on an instance being replaced by a different entity), and a second
  destroyed-flag (`secondaryDestroyed`) so `recipe-runner.ts` knows to remove
  the secondary instance too. All of it optional/unset by default, so every
  action defined before this stayed completely unaffected — verified by full
  regression, same discipline as every other engine change this session.
- **Runtime-assigned spawned instance IDs (`entityId-N`, global counter across
  the whole run) can't be predicted by reading a recipe file — they have to be
  run to find out.** First draft of `tortilla-de-patatas.json` guessed
  `egg_cracked-1`; the actual ID was `egg_cracked-3` (CRACK's own
  `["egg_shell", "egg_cracked"]` byproduct order, after `potato_peel-1` from an
  earlier step, ate counters 1 and 2 first). `validate.ts` can't catch this —
  it explicitly doesn't simulate a run, just logs a NOTE for any
  `targetInstanceId`/`secondaryInstanceId` not in `initialInventory`. Running
  the recipe and reading the actual log is the only real check.
- **A wrong/typo'd id in `availableIngredientInstanceIds` fails SILENTLY, not
  loudly — found this the hard way, not by design review.**
  `handmade-alioli-egg-yolk.json` referenced `"egg_yolk-1"` for months of
  session-time (several turns) when the actual spawned id was always
  `"egg_yolk-3"` — and it never errored, because `recipe-runner.ts`'s
  resolution (`inventory.get(id)?.entityId`, filtered for `undefined`) just
  drops an unresolvable id rather than failing. The step "worked" anyway
  because `oil-1` alone already satisfied `isEmulsifier`. A step can look
  correct in every log line and still be silently not using an ingredient you
  meant it to. Worth grep-checking recipe files for instance ids that don't
  appear anywhere as a spawn source, not just trusting a clean run.
- **Byproduct/combine spawning always hardcoded `tags: []` for the new
  instance, discarding the parent's tags — a real bug, not a hypothetical
  one.** Would have silently defeated a `pasteurize` → `separate` → `emulsify`
  safety chain: the whole point of tagging a pasteurized egg is that the tag
  survives being split into yolk/white. Fixed by inheriting the parent's (and,
  for `combinesInto`, the secondary instance's) tags into spawned instances,
  filtered against the spawned entity's own `possibleTags` so nothing
  semantically nonsensical leaks through. Every entity that's meant to receive
  an inherited tag needs that tag explicitly listed in its own `possibleTags`
  — the filter is a feature (stops garbage propagation), not a bug, but it
  means adding a new safety tag anywhere requires updating every entity
  downstream that should be able to carry it.
- **Not every safety shortfall deserves the same `advisoryOnly` treatment.**
  `egg_cooking.json` (a runny yolk from active cooking) is `advisoryOnly: true`
  — a real FDA-recognized "disclosed, diner accepts it" practice.
  `egg_pasteurization_raw.json` (raw egg yolk used with NO pasteurization step
  at all, e.g. in alioli) is `advisoryOnly: false` — a hard reject in every
  `SafetyPolicy` mode, including "human," on purpose: there's no equivalent
  "the child knowingly accepted this" framing for silently skipping the one
  mitigation available. The mechanism (`SafetyPolicy`) doesn't decide this by
  itself — the CCP author has to make the actual judgment call per hazard, and
  say why, not default every CCP to the same posture.
- **A recipe using a raw, safety-relevant ingredient (raw egg yolk) can run
  with ZERO enforcement for a long time if the enforcement mechanism is keyed
  to the wrong trigger.** `egg_cooking.json`'s CCP only checks on
  `FRY`/`SCRAMBLE`/`POACH`/`BOIL` — actions with a `durationSeconds` tied to
  active cooking. `handmade-alioli-egg-yolk.json` never cooks the yolk at all
  (that's the entire point of the dish), so that CCP silently never applied,
  across several turns of session-time, until directly asked to "refine" the
  recipe for real use. The fix needed a genuinely different CCP (a different
  point on the real time-temperature curve — low-temp, long-hold, stays raw —
  not a stricter version of the cooking one) tied to a NEW action
  (`PASTEURIZE`) that the recipe didn't previously have a reason to include.
  Worth checking, for any raw/never-cooked ingredient use: is there actually
  an action in the sequence the safety mechanism can attach to at all?
- **A boolean comparison against `NaN` is `false`, not an error — so
  `if (seconds < threshold)` silently SKIPS a safety check on malformed input
  instead of failing it.** Found by deliberately asking "what would a robot
  need this to guarantee" rather than by code review: the CCP-shortfall check
  in `engine.ts` only worked correctly because every CCP-linked action
  happens, by convention, to also declare `durationSeconds` as a validated
  `numericRange` parameter (which throws on `NaN` earlier in the same
  function) — the CCP check itself wasn't self-defending. Fixed with an
  explicit `Number.isNaN` guard right at the check, not relying on an
  implicit, unenforced coupling between two different parts of the function.
  General lesson: any comparison-based safety gate fed by user/parsed input
  needs its own guard against the input not being a valid number at all — a
  missing bounds check elsewhere in the same function is not a substitute.
- **`ActionSchema`'s precondition/effect shape (`requiredTargetCapability`
  etc. as preconditions, `outputs.*` as effects) turns out to already be a
  STRIPS/PDDL-style planning-operator representation — discovered by asking
  "what recipe format would a robot actually want," not by designing for it
  up front.** Every `RecipeScript.sequence` authored this session was a
  human (me) doing backward-chaining through that precondition/effect graph
  by hand, one file at a time — exactly the job an automated planner exists
  to do. This reframes `CONCEPT.md` §12's long-flagged, unreconciled fork
  (goal-based recipes vs. linear step-sequence): they're not actually
  competing formats, one is the compiled OUTPUT of planning against the
  other's GOAL spec. See `WORLD_MODEL.md`. Worth remembering generally: a
  schema built for one purpose (validating/executing hand-authored recipes)
  can turn out to already fit a different, larger purpose (automated
  planning) it was never explicitly designed for — recognizing that is
  cheaper than redesigning from scratch.
- **A dish name can be a false friend across cuisines/languages —
  "tortilla francesa" (Spanish: an everyday flat, fully-cooked plain omelette)
  and "French omelette" (the classical technique: baveuse, folded) are NOT
  the same dish despite the near-identical name.** Missed entirely until
  directly asked to think about what a robot needs to make either "as asked":
  the vocabulary could only express one flat/set outcome, no way to represent
  a fold or a deliberately-soft interior. Fixed with new informational
  parameters (`yolkDoneness`, `edgeStyle`, `internalTexture` on
  `fry.json`/`poach.json`) and a new `FOLD` action — plus two recipes sharing
  their first three steps EXACTLY, diverging only where the dishes actually
  diverge, so the difference is checkable in a diff, not just asserted in
  prose. General lesson: "make an omelette" isn't fully specified in any
  cuisine's default — yolk doneness and fold-or-not are usually the two axes
  that actually distinguish what was ordered, and neither was representable
  before being asked about. Worth asking, for any dish name: what's the most
  common real-world qualifier attached to an order for it, and is it actually
  representable yet?
- **A composite entity built from an at-risk ingredient (egg) needs its OWN
  `criticalControlPointsByAction` — inheriting the ingredient doesn't
  inherit the safety wiring.** `tortilla_mixture.json` (built from potato +
  egg via `COMBINE`) had zero HACCP enforcement, silently, until asked
  whether tortilla de Betanzos — a real dish DEFINED by an intentionally
  liquid, barely-cooked interior — was makeable. Exactly the same shape of
  gap `handmade-alioli-egg-yolk.json` had originally (a real safety-relevant
  ingredient present, but the specific action/entity pairing that needed a
  CCP reference never got one), the second time this exact class of bug has
  been found by asking about a specific real dish rather than by auditing in
  the abstract. General lesson, now twice-confirmed: whenever `COMBINE`
  (or any future entity-merging mechanism) produces a new composite entity
  from an at-risk ingredient, check whether the new entity's own
  `criticalControlPointsByAction` was actually populated — `structure.
  components` listing the ingredient is not the same as the safety wiring
  carrying over, and nothing currently enforces that it does.
- **Adding a CCP reference to an entity that previously had none can break a
  standalone script that calls `applyAction` directly without loading
  `ccps`** — not a flaw in the fix, the exact self-defending check
  (`"was ccps not loaded/passed into applyAction?"`) written for this precise
  situation, firing correctly for the first time. `attempt-tortilla.ts` never
  needed `ccps` before because `tortilla_mixture` had nothing to reference;
  once it legitimately did, the standalone demo needed the same `loadCcps()`
  wiring the recipe-driven path already had. Any change that adds a new
  `criticalControlPointsByAction` entry to an existing entity should be
  treated as a potential breaking change for scripts that construct
  `Instance`s directly (not through `run-recipe.ts`) — full regression across
  the standalone demos, not just the recipes, is what actually caught this.
- **A systematic sweep (every cooking-capable entity × its CCP wiring) found
  ZERO further gaps after the Betanzos fix — worth doing proactively once a
  pattern repeats twice, not waiting for a third dish to find a third
  instance.** `tortilla_mixture` had the gap `handmade-alioli-egg-yolk` had;
  once the same shape of bug showed up twice, auditing every
  `isFryable`/`isBoilable`/`isPoachable`/`isScramblable` entity against its
  `criticalControlPointsByAction` directly (rather than continuing to wait
  for the next specific dish to expose the next instance) confirmed the
  vocabulary was actually clean — `potato`/`potato_peel`/`garlic` correctly
  have none (no comparable pathogen risk), everything egg-derived correctly
  does. Turned into a permanent `validate.ts` NOTE (cooking capability +
  zero CCP wiring) so this stays checked going forward, not just fixed once.
- **The same inconsistent-rigor pattern existed for citations, not just
  safety wiring — `egg`/`garlic` got an explicit "not independently
  verified" hedge, `potato`/`salt`/`water`/`oil`/`egg_yolk`/`egg_white`/
  `egg_cracked` didn't, for numbers with identical epistemic status.** Fixed
  with a real `CitationSchema` (source + two honest confidence tiers —
  deliberately no "primary_source" tier, since nothing in this repo has ever
  been checked against one) added to `CompositionSchema`/
  `ThermophysicalPropertiesSchema`, populated across every entity: USDA
  FoodData Central for food composition, the CRC Handbook for pure chemical
  constants (salt, water), Choi & Okos (1986) for the food-thermal-property
  model, Eric Block's Allium chemistry work for garlic's flavor-chemistry
  claim. Distinguishing WHY salt's melting point is higher-confidence than
  potato's water content (pure compound, no natural variance, vs. a
  biological product averaged across cultivars) is itself the more
  scientifically honest position — not flattening every citation to the same
  confidence level for consistency's sake.
- **Citing salt's sodium content properly (instead of re-asserting the same
  hedge) surfaced an actual, fixable numeric error**: the stored value
  (38758mg/100g) was 1.49% off from the exact stoichiometric figure
  (39337mg/100g, computed from IUPAC standard atomic weights — table salt is
  essentially pure NaCl, so this is exactly derivable, not an empirical
  approximation with real biological variance like the food-composition
  figures). Found only by actually doing the arithmetic while sourcing the
  citation, not by the citation exercise alone — "add a source" and "check
  the number is actually right" turned out to be different, complementary
  checks, and only doing the first would have left this wrong.
- **Citing water's boiling point surfaced an unaddressed gap with no
  workaround yet, not something fixable in the same pass**: 100°C is only
  correct at 1 atm/sea level — this repo has no altitude/pressure parameter
  anywhere, so every BOIL/POACH duration and every CCP threshold implicitly
  assumes sea level. Recorded as a real, open gap (in `water.json`'s new
  citation note) rather than silently assumed away — a robot operating at
  meaningful altitude would need this accounted for and currently can't get
  it from this model.
- **Implementing the REAL D-value/z-value thermal-death-time model (the actual
  math the FDA Food Code's own tables are built from) instead of two
  hand-picked anchor points found a genuine, computable ~4x discrepancy
  between my two existing egg-pasteurization CCPs — not a bug, but real
  physics I hadn't made visible.** Both CCPs cite 57°C as a hold temperature;
  one requires 3900s (in-shell), the other's real model predicts only ~975s
  would be needed at 57°C (liquid). Computing that gap rather than asserting
  "the shell matters" turned a plausible-sounding claim into a checkable
  number (`node -e` one-liner, `~4.00x`, matches the expected order of
  magnitude for real heat-penetration lag through a shell). General lesson:
  where a genuinely standard, textbook formula exists (D/z-value kinetics is
  not novel, it's how the reference tables were made in the first place),
  implementing it as real, runnable math finds inconsistencies that citing
  two separately-sourced numbers side by side will not — the numbers looked
  independently plausible until asked to agree with each other via the same
  formula.
- **The real math also produced a genuine simplification, not just more
  rigor**: once egg_yolk could be pasteurized directly (already-liquid,
  no shell — the case where the model's uniform-temperature assumption is
  actually valid), the alioli-with-egg-yolk recipe's wait dropped from 65
  minutes to 3.5, backed by an actual USDA-cited regulated figure instead of
  an in-shell process ported over by analogy. Being MORE correct (recognizing
  two different physical scenarios need two different, properly-scoped
  models) and MORE convenient (much shorter real recipe) turned out to be the
  same fix, not a tradeoff — worth remembering that "more rigorous" and
  "simpler for the end user" aren't always in tension.
- **Auditing every action for "is blind retry safe" found a real bug: `PEEL`
  can spawn a byproduct that doesn't physically exist.** `PEEL` neither
  `destroysTarget` nor checks the target isn't already peeled — so a robot's
  fault-recovery layer blindly re-issuing "PEEL potato-1" after an
  interruption would spawn a SECOND `potato_peel` instance. You cannot peel a
  potato twice and get two peels. The only `retrySafe: false` among all 21
  actions, found only because the question was asked of every single one, not
  because anyone flagged PEEL specifically. General lesson: "does re-running
  this after a fault cause a double-effect" is worth asking of EVERY
  destructive-adjacent action explicitly, not assumed safe by default — two
  genuinely different reasons turned out to make most actions actually safe
  (idempotent-by-construction, via engine.ts's existing `addsTag` dedup guard;
  or fails-loudly via `destroysTarget` already having removed the target) —
  and PEEL had neither.
- **Filling repetitive structured domain data (verification/hazards/retry
  info) across 21 files by hand invites exactly the kind of silent omission
  this whole effort was trying to prevent — write a small one-off script
  instead, then manually add the nuance that actually needs a human's
  judgment.** Batch-applying a lookup table caught its own gap immediately
  (missed 2 of 21 actions in the first pass, `bake`/`beat` — a whole-file
  scan of `validate.ts`'s new NOTE output caught it right away, which is
  exactly why that soft audit check was added to the tool in the first place,
  not left as something to remember to check manually).
- **`boil.json` had ZERO parameters — not even `durationSeconds` — despite
  `egg.json`'s `criticalControlPointsByAction.boil` already referencing a CCP
  that checks exactly that.** It still worked, because the CCP check reads
  `params["durationSeconds"]` directly, independent of whether the action
  formally declares it — but without a declared `numericRange`, `BOIL` never
  got the sane-bounds/`NaN` validation `FRY`/`POACH`/`PASTEURIZE` all get from
  the `parameters[]` loop. This is the exact concrete case the standalone
  `Number.isNaN` guard added to the CCP check (a turn earlier, found by asking
  "what would a robot need this to guarantee") existed to protect — not a
  hypothetical, a real gap sitting in the same file the CCP referenced. Found
  by deliberately auditing for parity across the cooking actions, not by
  anyone flagging it directly. Worth periodically checking: does every action
  wired to a CCP actually declare the parameter that CCP depends on?
- **Carryover (residual) cooking is real, and `BOIL` was quietly pretending it
  doesn't exist.** An egg keeps cooking for a period after leaving boiling
  water — outer layers are hotter than the center, and that stored heat keeps
  diffusing inward with zero external heat applied — so `durationSeconds`
  alone does not fully determine final doneness; what happens immediately
  after boiling does too. `BOIL`'s `transformedState: "boiled"` firing the
  instant `durationSeconds` is reached was always a simplification of a
  continuous process — exactly `WORLD_MODEL.md`'s abstract point (`Instance.
  state` as a derived classification, not the underlying continuous reality)
  showing up concretely, unprompted, in a dish rather than in a design
  document. Fixed with `SHOCK` (an ice bath, `addsTag: "shocked"`) — not a
  physics simulation (still correctly out of scope), just an explicit lever
  to actually arrest the process at a known point, which is the honestly-
  scoped answer, not a fuller simulation.

## 2026-08-13

### Test runner (ROADMAP.md Phase 0, closed)

- **`node:test` (built into Node 24, already the runtime here) + `tsx` as
  the loader needs an explicit glob, not a directory, as its file arg.**
  `node --import tsx --test tests/` throws `ERR_UNSUPPORTED_DIR_IMPORT` —
  tsx's own resolver intercepts the bare directory path before node:test's
  file-discovery glob logic gets to it. `node --import tsx --test
  tests/*.test.ts` (shell-expanded explicit file list) works fine. No new
  devDependency needed (`vitest`/`jest` were the assumed candidates in
  ROADMAP.md's original phrasing; `node:test` was better-fitting since this
  repo already runs everything through `tsx`, not a bundler).
- **Zod's `z.infer` (post-default output type) is the wrong type to build
  test-fixture builders against — use `z.input` instead, and `Partial<>`
  it.** A helper like `makeAction({ id, outputs: { transformedState: "x" } })`
  needs `outputs` to accept a partial object (missing
  `spawnsTargetByproducts`/`destroysTarget`, which Zod fills in at parse
  time) — `Partial<Action>`'s `outputs` field is typed as the FULL
  post-default `ActionOutputs` shape (booleans required), so TypeScript
  rejected every fixture that only set one field. `Partial<z.input<typeof
  ActionSchema>>` uses the pre-default shape instead, where those same
  fields are genuinely optional — matches what `.parse()` actually accepts.
- **A regression test is only proven to catch its regression by actually
  breaking the code and watching it fail red** — same discipline as every
  other check in this repo (this file's running theme: "caught by running
  it, not by reading the code"). Deliberately removed the
  `Number.isNaN(seconds)` guard `engine.ts`'s CCP check depends on (see the
  2026-08-12 entry on this same guard) and confirmed exactly the intended
  test failed, then restored it — the other 43 tests staying green in the
  same run is itself a check that the fixture builders aren't accidentally
  coupled to each other.
- **`tsconfig.json`'s `include` didn't cover `tests/` by default** — added
  it, since `npx tsc -p . --noEmit` is one of the two authoritative checks
  this repo runs after any change ("Process" section above), and a test
  file with a real type error should fail that check like any other file,
  not be silently skipped because it lives outside `src`/`scripts`.
- **Unit tests (fast, synthetic `Entity`/`Action`/`CriticalControlPoint`
  fixtures built with minimal `.parse()`-validated builders) and
  `scripts/validate.ts` + the demo/recipe scripts (slower, exercise the
  real `data/*.json`) are complementary, not redundant.** The unit suite
  pins down `engine.ts`'s branch logic in isolation (e.g. "does
  `combinesInto` merge tags from both instances, filtered by
  `possibleTags`" — provable in ~15 lines with two throwaway entities)
  without needing a real recipe file to exercise it; the integration layer
  still catches the class of bug the unit suite structurally cannot (a
  real `data/entities/*.json` referencing a CCP id that doesn't exist,
  runtime-assigned instance ids from an actual run not matching what a
  recipe file guessed — the "wrong/typo'd id" entry above). Neither
  replaces the other; both now belong in the standard post-change check
  list (`npm test`, `npm run validate`, every demo, every recipe, `tsc`).

### Salting timing + quantity (asked about the same day, closed same session)

- **`SALT` had no notion of WHEN relative to cooking it happens, and that's
  not a cosmetic gap — pre-salting draws moisture out via osmosis (drier
  surface, better browning/crisping when fried) while post-salting is
  surface-only seasoning with zero effect on the cook.** Closed with an
  informational `timing` parameter (`before_cooking`/`during_cooking`/
  `after_cooking`) on `salt.json`, same non-enforced pattern as `fry.json`'s
  `heatLevel`/`doneness` — still doesn't feed back into `FRY`'s actual
  outcome (that would need `FRY` to read a moisture/salting-history signal,
  flagged as a real, separate, unbuilt gap in `salt.json`'s
  `timingNote`). Retrofitted onto all 9 existing recipes that call `salt`
  after an upstream cook step exists, using the recipe's actual step order
  to decide the value (not guessed) — the 2 alioli recipes were correctly
  left without a `timing` value, since garlic is never cooked in either
  dish and the parameter wouldn't mean anything there.
- **A from-scratch batch-edit of several recipe JSON files via
  `json.dump()` silently reformats the WHOLE file** (compact single-line
  array entries become multi-line, unrelated whitespace changes throughout)
  **even when only one field actually changed** — caught immediately by
  `git diff` showing a wall of noise for a one-key edit, not by anticipating
  it. Reverted and redid the same 9 edits as literal string replacements
  (`Edit`/targeted `str.replace`) that touch only the line that changed.
  General lesson: never round-trip a hand-formatted JSON file through a
  generic serializer for a small edit — diff what you're about to write
  before trusting it, or edit the text directly.
- **Quantity ("how much is a pinch, compared to what?") was not a small
  follow-up question — it's `ROADMAP.md` Phase 1's known-unbuilt
  `RecipeIngredientSchema`, and it's the thing the OTHER two questions
  asked the same session (crystal size, generalizing SALT to
  pepper/chili) actually sit on top of, not a peer of either.** Confirmed
  by grep before building anything: zero quantity representation existed
  anywhere (`RecipeInstanceSchema` had `id`/`entityId`/`state`/`tags`, no
  amount field at all) — `salt-1` was "a salt instance that exists," not
  "3g of salt." Worth recognizing explicitly when several small-sounding
  questions arrive in a burst: check whether they're actually independent,
  or whether one is foundational and the others are downstream of it — build
  in dependency order, not arrival order.
- **"A pinch" and "2% of flour by weight" are not the same KIND of
  quantity, and collapsing them into one `amount` field would misrepresent
  whichever one doesn't fit** — this is why `QuantitySchema` is a
  3-way discriminated union (`precise`/`imprecise`/`relative`), not a
  single number+unit. `imprecise` exists because cooks genuinely do not
  measure a pinch (forcing a fake gram value would itself violate this
  repo's own "don't imply more precision than was verified" standard,
  already established for `CitationSchema`); `relative` exists because
  some real quantities (professional bread salt, dosed as a baker's
  percentage of flour mass) genuinely ARE precise but answer "how much"
  only in terms of another ingredient, not an absolute number — directly
  answers "a pinch, compared to what?" for the cases where the honest
  answer is "it doesn't compare to anything, it's just vague" vs. the
  cases where the honest answer is "precisely 2% of the flour."
- **A pinch's real-world gram equivalent depends on the SAME crystal-size
  axis raised as a separate question in the same conversation (coarse vs.
  fine salt) — the two gaps aren't independent, one is a concrete instance
  of the other.** Recorded directly in `QuantitySchema`'s `"imprecise"`
  branch doc comment rather than treated as unrelated, so the connection
  isn't lost between the two LEARNINGS entries. Crystal size itself (fine
  table salt vs. coarse sea salt vs. kosher as separate entities, or a
  property on one) remains genuinely unbuilt — deliberately deferred
  rather than guessed at, same reasoning as `garlic-oil-potatoes.json`'s
  salad gap: name it precisely, don't build it speculatively until a real
  dish needs to distinguish them.
- **Generalizing `SALT` into a parameter-driven `SEASON` verb (so pepper/
  chili don't need copy-pasted actions) was deliberately NOT built this
  session, on the user's own call, in favor of building quantity first.**
  Real blocker if it had been attempted: `ActionOutputsSchema.addsTag` is a
  fixed string today, with no `addsTagFromParameter` counterpart to
  `transformedStateFromParameter` — and `requiredIngredientCapabilities`
  only checks presence, never identifies WHICH specific instance among
  several satisfied the capability, so there'd be no way to know which
  literal tag to add even with that engine feature. Both real, both still
  open — next real dish that needs a second seasoning (not just salt)
  should be what drives building this, per this repo's established working
  method, not built ahead of that need.
- **Told directly to build PEPPER/CHILI without the SEASON generalization
  (engine work explicitly paused) — duplicating SALT's shape found a real
  correctness bug BEFORE it shipped, not after.** `requiredIngredientCapabilities:
  ["isSeasoning"]` on `salt.json`'s action was fine when salt was the only
  entity declaring `isSeasoning: true` — the moment `black_pepper`/
  `chili_flakes` were added with the same generic flag, `SALT` would have
  silently accepted pepper as satisfying "a salt-like ingredient is
  present." Caught by asking "does adding a sibling break the existing
  one" before writing the new entities, not by testing after — fixed by
  splitting the generic `isSeasoning` (kept, genuinely useful as "is this
  A seasoning at all") from three specific capabilities
  (`isSaltySeasoning`/`isPepperySeasoning`/`isSpicySeasoning`) that each
  verb's `requiredIngredientCapabilities` actually checks. Proven, not just
  reasoned about: `scripts/season-potato-three-ways.ts`'s last check
  deliberately tries to SALT a potato with only `black_pepper` on hand and
  asserts it's rejected.
- **`ActionOutputsSchema.addsTag` is applied by `applyAction` completely
  independent of the target entity's `possibleTags`** — only byproduct/
  `combinesInto` tag INHERITANCE is filtered against `possibleTags`
  (`engine.ts`), the primary `addsTag` path never was. This means an entity
  could `allowedTransformations`-permit an addsTag-shaped action without
  ever listing the resulting tag in its own `possibleTags`, and nothing
  would catch it — not a hypothetical, found while manually wiring
  "peppered"/"chili_seasoned" onto potato/egg/egg_cracked and realizing
  there was no check forcing that step to be remembered. Added as a
  permanent `scripts/validate.ts` NOTE (not a hard fail — the asymmetry
  with inheritance-filtering is real, so a false-positive-safe soft check
  is the honest one) rather than trusting it to be done right by hand
  again next time. Proven to fire by deliberately dropping "peppered" from
  potato.json's possibleTags and confirming the NOTE appeared, then
  reverting — same discipline as every other check in this repo.
- **Extending a closed enum (`CRUSH`'s `fineness`: `coarse`/`fine_paste` →
  + `cracked`/`ground`) to fit a second, differently-shaped use case (whole
  peppercorns, which never become a paste) is backward-compatible by
  construction — worth reaching for before assuming a new parameter or new
  verb is needed.** Same reasoning `CUT`'s single `shape` enum already
  generalizes across every choppable entity, applied here for the first
  time to a SECOND action (`CRUSH`) instead of just cited as precedent.
- **A gap flagged honestly in a doc comment, then left alone, is worth
  actually revisiting once the vocabulary grows into it — not just citing
  as "still true."** `garlic.json`'s `flavorChemistryNote` flagged
  `SensoryPropertiesSchema.taste`'s missing "pungent" category back on
  2026-08-12 (allicin's sharpness isn't one of the five basic tastes,
  'umami' was the closest available value, not the correct one) but wasn't
  fixed then — closed now, adding black pepper (piperine) and chili
  (capsaicin) made it load-bearing for THREE entities' sensory accuracy at
  once instead of one, not just garlic's.
- **User-directed scope change ("don't worry about the engine yet, get
  common knowledge into schemas") is a real instruction to prioritize
  breadth-of-coverage work over the engine-consumption work flagged as
  open in the previous entries — not a request to build speculatively
  everywhere.** Handled by: (1) still choosing the concretely-teed-up next
  step (seasoning generalization) rather than picking an arbitrary new
  domain, (2) auditing what's ACTUALLY unrepresented (allergens, cross-
  contamination, staple-ingredient breadth, more verbs) and writing it down
  as a prioritized, honestly-scoped list (`ROADMAP.md`'s new "Common
  culinary knowledge coverage" section) rather than either silently picking
  one to build next unprompted or claiming "all common knowledge" was
  actually achieved in one session — "all" is not a completable claim to
  make honestly here, a checkable list is.

### Heat sources (gas/vitro/wood) + egg-boiling doneness timing

- **A new, real-world domain (heat providers) needed its own top-level
  knowledge collection, not a field bolted onto `EntitySchema`, and
  `CriticalControlPointSchema`/`data/ccps/` was the right precedent to
  copy, not `EntitySchema.thermophysical`.** Tried to attach heat-source
  facts to `EntitySchema` first and hit a real circular-import problem
  immediately: a `HeatSourceProfileSchema` needs `CitationSchema` (defined
  in `ingredient.ts`), but making `EntitySchema` reference
  `HeatSourceProfileSchema` back would require `ingredient.ts` to import
  from the new file too — a genuine cycle, not a style preference. Solved
  by recognizing this is structurally the SAME problem `thermal.ts`/
  `data/ccps/` already solved for CCPs (a fact that doesn't belong to one
  entity, referenced BY id from wherever needed): `src/heat-source.ts` +
  `data/heat-sources/*.json` + `registry.ts`'s `loadHeatSources`, one-way
  import from `heat-source.ts` to `ingredient.ts` only. Worth recognizing
  generally: hitting a circular import is sometimes a signal the new
  concept is a peer of an existing top-level collection, not a child field
  of an existing entity — check for a same-shaped precedent already in the
  repo before restructuring imports to force the field-on-entity shape.
- **The single most important fact to get right here, stated explicitly
  because it's a real, common misconception: which heat source you use
  changes how FAST water reaches boiling, never the TEMPERATURE it boils
  at.** Water is ~100°C at sea level whether it's a bare simmer or a
  roaring boil — pressure/altitude is the only thing that moves that
  number (`water.json`'s existing citation). Modeling heat source as
  adjusting `BOIL`'s required `durationSeconds` (time spent AT
  temperature — what actually cooks the egg) would have been physically
  wrong, not just imprecise; `heat-source.ts`'s new `heatSource` parameter
  on `boil.json` is deliberately informational-only, same non-enforcement
  pattern as `heatLevel` elsewhere, specifically so it can't accidentally
  end up feeding into that number.
- **Asked directly not to overstate precision here, and the honest answer
  required two separate corrections to what had just been built, not one.**
  (1) `estimatedPreheatSeconds` uses one constant average power/efficiency
  value across the whole heating interval — real delivered heat is a
  continuously time-varying curve (most obviously for wood fire, but
  genuinely true for gas/vitro's own startup ramp too); this is now stated
  explicitly as a first-order energy-balance estimate, not a curve
  simulation, matching `thermal.ts`'s own "validity condition" discipline
  for its D/z-value model. (2) A skilled cook's real fine control over
  delivered heat is NOT fully captured by the source's own dial/damper —
  physically moving the pan (off flame, to a fire's cooler edge, lifting
  it) is a real, separate control technique, most load-bearing on wood
  fire specifically because the fire itself often can't be finely dialed
  at all. Added `manualPositioningRelevance` (low/moderate/high per source)
  to name this honestly rather than let `controlPrecision` alone imply it
  was already covered. General lesson: when told "I don't want to go that
  deep, but be scientifically accurate," the right response is not
  refusing to note the limitation — it's stating the limitation precisely
  enough that a reader knows exactly what's NOT modeled, at whatever depth
  the model itself stays.
- **"If I tell a robot I want my egg medium boiled, I want it to
  understand it" pointed at a real, load-bearing, previously-silent gap:
  `boil.json`'s `yolkDoneness` (soft/medium/hard) was a label with ZERO
  attached meaning anywhere in this repo** — informational-only, by design,
  same as `heatLevel`/`doneness` elsewhere, but for THIS parameter that
  meant "medium" resolved to literally nothing a robot (or a human) could
  act on. Closed at the reference-data layer, not the engine layer, on
  purpose: `src/egg-doneness.ts`'s `EGG_BOIL_DONENESS` gives "medium" a
  real, cited seconds range (480-540s) instead of nothing — but
  `applyAction` still doesn't compute `durationSeconds` FROM `yolkDoneness`
  automatically. That's a deliberate line, not an oversight: CONCEPT.md
  §14 already establishes that resolving a customer's stated intent into
  concrete parameters is the LLM-intent-layer's job, not this schema's
  (the exact same principle `fry.json`'s tortilla-francesa/French-omelette
  disambiguation note applies) — this repo's job is making sure that
  resolution has something REAL and GROUNDED to resolve against, which it
  now does, not doing the resolving itself.
- **A new reference table is worth cross-checking against data that
  already existed before it, not just trusting it in isolation.**
  `EGG_BOIL_DONENESS`'s "soft" range (360-420s) was checked against
  `soft-boiled-egg.json`'s already-existing choice of 390s (picked in an
  earlier session, before this table existed) — it falls inside the range,
  a real consistency check, not a coincidence assumed without checking.
  Turned into a permanent unit test (`tests/egg-doneness.test.ts`) so this
  stays checked on every future change, not just verified once by hand.
  Cold-start timing was deliberately left OUT of the new table for the
  opposite reason — checked whether preheat-time + hold-time could just be
  added together for that case and concluded no (the egg cooks gradually
  through the whole ramp, not just once boiling), so a wrong number wasn't
  shipped just to have complete coverage.
- **Salt added to egg-boiling water is real, common technique — but it is
  NOT an instance of `SALT`'s existing seasoning mechanism, and forcing it
  into that verb would have been a category error.** `SALT`/`addsTag:
  "salted"` exists because of osmosis/browning/flavor chemistry
  (`salt.json`'s `timingNote`); salting boiling water for an egg is
  causally different (faster coagulation of leaked white sealing a crack
  if the shell breaks) and isn't really about flavor at all — the egg
  barely absorbs salt from the water in ~10 minutes, unlike a porous food
  cooked longer in salted water (pasta, potato). Documented as a real,
  correctly-scoped, deliberately-not-built gap (`egg.json`'s new
  `crackContainmentNote`) rather than either ignored or mis-modeled via
  the wrong verb just to "have something" — same discipline
  `infuse.json`'s `safetyNote` already established for a differently-shaped
  CCP mismatch. Also explicitly did NOT repeat the commonly-claimed
  "salted water peels eggs easier" — checked confidence on that specific
  claim separately from the crack-containment one and found it weaker/
  disputed (freshness and shocking are the better-supported explanations),
  and said so rather than flattening both claims to the same certainty.
````

## File: src/engine.ts
````typescript
import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import { requiredHoldSeconds, type CriticalControlPoint } from "./thermal.ts";

/**
 * Minimal execution engine — applies one canonical Action to one instance.
 *
 * This is a stepping stone toward ROADMAP.md Phase 4's full
 * `OcrValidationEngine` (a full INVALID_TRANSITIONS forbidden-transition
 * matrix, HACCP, an ordered recipe sequence). It checks: the target
 * entity's capability, required tools being on hand, `Entity.statePrerequisites`
 * (a narrower per-action "must already be in this state first" precondition,
 * e.g. potato.json: cut requires "peeled"), the action's declared
 * `parameters` (e.g. CUT's "shape"), and — new — `requiredIngredientCapabilities`
 * (e.g. FRY needs some available ingredient with isFryingMedium, like oil).
 * It does NOT yet check arbitrary forbidden state transitions in general
 * (e.g. nothing here stops peeling an already-boiled potato) — that needs
 * the fuller transition table Phase 4 will add. It also only checks that a
 * qualifying ingredient is *present*, not consume/decrement it — real
 * quantity tracking belongs to Phase 4's recipe-level inventory.
 *
 * `state` and `tags` are deliberately separate: `state` is the one
 * mutually-exclusive form/cooking-method value (raw/washed/.../boiled/
 * fried/...), while `tags` holds any number of orthogonal properties
 * (e.g. "salted") that coexist with whatever the current state is — see
 * ActionOutputsSchema.addsTag in action.ts.
 *
 * `ExecutionResult.destroyed` (driven by `action.outputs.destroysTarget`)
 * is the conservation-of-mass case CLAUDE_DEV_CTX.md and ROADMAP.md Phase 4
 * call out: e.g. SEPARATE on an egg — the caller (recipe-runner.ts) must
 * drop the target from inventory instead of writing `instance` back, while
 * still spawning `spawned` in its place. This engine only implements that
 * for a single explicit action's target; it is not the general "decrement
 * quantities against an arbitrary inventory" system Phase 4 ultimately
 * wants.
 *
 * `secondaryInstance` / `ExecutionResult.secondaryDestroyed` (ROADMAP.md
 * Phase 4, "multi-instance composition" — added once the tortilla
 * capability test proved it necessary, see LEARNINGS.md 2026-08-12): a
 * COMBINE-shaped action (`action.requiredSecondaryCapability` set) merges a
 * SECOND instance into the result, not just the primary target — e.g. fried
 * potato + beaten egg -> tortilla_mixture. Both the primary target and
 * `secondaryInstance` are destroyed; one new instance of
 * `action.outputs.combinesInto` is spawned in `spawned`, same array
 * `spawnsTargetByproducts` already uses. `secondaryInstance` is optional and
 * `requiredSecondaryCapability` defaults unset, so every action that
 * doesn't declare it — i.e. everything before this addition — is completely
 * unaffected.
 *
 * HACCP (ROADMAP.md Phase 2/4, thermal.ts): if the target entity names a
 * CriticalControlPoint for this action (`criticalControlPointsByAction`,
 * ingredient.ts) and the step supplied a "durationSeconds" parameter, that
 * duration is checked against the CCP's `heldSeconds`. This engine does
 * NOT simulate heat transfer — it has no model of the actual internal
 * temperature reached, only the declared cook time. The check therefore
 * rests on an explicit, stated assumption: any heat level a cook would
 * plausibly use for this action (a hot pan, simmering water) is already
 * well above the CCP's `heldC` floor, so elapsed time is the binding
 * constraint, not temperature. That assumption is only reasonable for
 * thin, fast-heating preparations (a fried/poached/scrambled egg, a few
 * millimeters through) where the coldest point still heats quickly — it
 * would NOT hold for a thick dish (a baked egg casserole) where the
 * center can lag the surface by minutes; nothing here should be reused
 * for that case without revisiting this assumption first.
 *
 * A shortfall throws unless the CCP is `advisoryOnly`, in which case it's
 * appended to `ExecutionResult.warnings` instead — the FDA Food Code's
 * actual "increased risk, permitted with disclosure" posture for e.g. a
 * runny egg yolk, not a hard ban — UNLESS `policy.mode === "autonomous"`
 * (SafetyPolicy, below), where an unoverridden advisory is *also* a hard
 * reject: CONCEPT.md §17 says a robot drives the same event timeline as a
 * human, same API, but "same API" cannot mean "same default judgment call"
 * when there is no human to make it. "human" (the default) preserves the
 * original warn-and-continue behavior unchanged for every existing caller.
 *
 * CONCEPT.md §17 also means every categorical "informational only, not
 * enforced" parameter this codebase has accumulated (fry.json's heatLevel/
 * agitation/doneness, scramble.json's curdSize, emulsify.json's
 * oilAdditionRate, poach.json's waterTempC, ...) needs to be read
 * correctly for what it actually is: a human-readable technique hint, NOT
 * a calibrated robot control setpoint. "heatLevel: high" has no defined
 * mapping to an actual actuator command — a controller that invented one
 * unilaterally would itself be a safety problem, not a solution to one.
 * Autonomous execution of any of this would need a real translation/
 * control/perception layer (closed-loop temperature control, computer
 * vision for "golden" vs "brown", force feedback for CRUSH's fineness,
 * physical proximity/hazard sensing for a knife or a hot pan near a
 * person) that does not exist in this repo. SafetyPolicy's "autonomous"
 * mode only changes what happens to a stated HACCP time threshold — it
 * does NOT mean the rest of this engine is robot-ready. Flagged here
 * deliberately rather than letting "autonomous mode exists now" imply
 * more than it does.
 */

export interface Instance {
  entityId: string;
  state: string;
  tags: string[];
}

/**
 * Execution policy for who's actually driving — CONCEPT.md §17: a robot
 * "consumes/drives the same event timeline a human session would," same
 * API, but that can't mean same DEFAULT for a safety shortfall. An
 * advisoryOnly CCP shortfall (thermal.ts) warns-and-continues under
 * "human" — the existing default, and the right one when a person is
 * present to judge a runny yolk for themselves. Under "autonomous" (a
 * robot with no human directly supervising this step), the same shortfall
 * is a hard reject by default: no judgment call to defer to. It only
 * proceeds if the specific CCP id is in `humanOverrides` — an explicit,
 * prior authorization (e.g. a diner ordered a soft yolk knowingly), not a
 * blanket "trust the robot" switch. Defaults to "human" so every existing
 * caller's behavior is unchanged unless it opts in.
 */
export interface SafetyPolicy {
  mode: "human" | "autonomous";
  humanOverrides?: ReadonlySet<string>;
}

const DEFAULT_SAFETY_POLICY: SafetyPolicy = { mode: "human" };

export interface ExecutionResult {
  /** The target's state/tags right before this action finished — still
   *  populated even when `destroyed` is true, for logging purposes; the
   *  caller must not write it back into inventory in that case. */
  instance: Instance;
  spawned: Instance[];
  /** True when `action.outputs.destroysTarget` fired: the caller must
   *  remove the target from inventory rather than keep `instance`. */
  destroyed: boolean;
  /** True when a secondary instance (COMBINE-shaped action) was consumed —
   *  the caller must remove IT from inventory too, same as `destroyed` for
   *  the primary target. Always false when the action has no
   *  requiredSecondaryCapability. */
  secondaryDestroyed: boolean;
  /** Non-fatal HACCP notices (see the CCP paragraph in the file doc
   *  comment above) — e.g. a duration below an advisoryOnly CCP's
   *  heldSeconds. Empty when no CCP applies or the threshold was met. */
  warnings: string[];
}

export function applyAction(
  instance: Instance,
  action: Action,
  entities: Map<string, Entity>,
  availableTools: ReadonlySet<string>,
  params: Readonly<Record<string, string>> = {},
  availableIngredients: ReadonlySet<string> = new Set(),
  ccps: ReadonlyMap<string, CriticalControlPoint> = new Map(),
  policy: SafetyPolicy = DEFAULT_SAFETY_POLICY,
  secondaryInstance?: Instance
): ExecutionResult {
  const target = entities.get(instance.entityId);
  if (!target) {
    throw new Error(`Unknown entity "${instance.entityId}"`);
  }

  if (!action.validTargetKinds.includes(target.kind)) {
    throw new Error(`${action.verb} cannot target entity kind "${target.kind}" ("${target.id}")`);
  }

  const requiredPriorState = target.statePrerequisites[action.id];
  if (requiredPriorState && instance.state !== requiredPriorState) {
    throw new Error(
      `${action.verb} requires "${target.id}" to already be "${requiredPriorState}" (currently "${instance.state}").`
    );
  }

  if (action.requiredTargetCapability) {
    const has = target.capabilities[action.requiredTargetCapability];
    if (has !== true) {
      const why = has === false ? "explicitly false" : "unasserted";
      throw new Error(
        `${action.verb} requires capability "${action.requiredTargetCapability}" on "${target.id}", but it is ${why}.`
      );
    }
  }

  let secondaryEntity: Entity | undefined;
  if (action.requiredSecondaryCapability) {
    if (!secondaryInstance) {
      throw new Error(
        `${action.verb} requires a secondary instance (capability "${action.requiredSecondaryCapability}"), but none was supplied.`
      );
    }
    secondaryEntity = entities.get(secondaryInstance.entityId);
    if (!secondaryEntity) {
      throw new Error(`Unknown secondary entity "${secondaryInstance.entityId}"`);
    }
    const has = secondaryEntity.capabilities[action.requiredSecondaryCapability];
    if (has !== true) {
      const why = has === false ? "explicitly false" : "unasserted";
      throw new Error(
        `${action.verb} requires secondary capability "${action.requiredSecondaryCapability}" on "${secondaryEntity.id}", but it is ${why}.`
      );
    }
  }

  for (const toolId of action.requiredTools) {
    if (!availableTools.has(toolId)) {
      throw new Error(`${action.verb} requires tool "${toolId}", which is not available.`);
    }
  }

  for (const capability of action.requiredIngredientCapabilities) {
    const satisfied = [...availableIngredients].some(
      (id) => entities.get(id)?.capabilities[capability] === true
    );
    if (!satisfied) {
      throw new Error(
        `${action.verb} requires an available ingredient with capability "${capability}", but none is on hand.`
      );
    }
  }

  for (const param of action.parameters) {
    const value = params[param.id];
    if (value === undefined) {
      if (param.required) {
        const allowed = param.allowedValues
          ? `one of ${param.allowedValues.join(", ")}`
          : `a number between ${param.numericRange!.min} and ${param.numericRange!.max} ${param.numericRange!.unit}`;
        throw new Error(`${action.verb} requires a "${param.id}" parameter: ${allowed}.`);
      }
      continue;
    }
    if (param.allowedValues) {
      if (!param.allowedValues.includes(value)) {
        throw new Error(
          `${action.verb} got "${param.id}: ${value}", but only ${param.allowedValues.join(", ")} are valid.`
        );
      }
    } else {
      const range = param.numericRange!;
      const num = Number(value);
      if (Number.isNaN(num) || num < range.min || num > range.max) {
        throw new Error(
          `${action.verb} got "${param.id}: ${value}", but expected a number between ${range.min} and ${range.max} ${range.unit}.`
        );
      }
    }
  }

  let nextState = instance.state;
  if (action.outputs.transformedState) {
    nextState = action.outputs.transformedState;
  } else if (action.outputs.transformedStateFromParameter) {
    const value = params[action.outputs.transformedStateFromParameter];
    if (value === undefined) {
      // Only reachable if that parameter was declared optional; a required
      // one is already guaranteed present by the loop above.
      throw new Error(
        `${action.verb} needs "${action.outputs.transformedStateFromParameter}" to determine the resulting state.`
      );
    }
    nextState = value;
  }

  let nextTags = instance.tags;
  if (action.outputs.addsTag && !instance.tags.includes(action.outputs.addsTag)) {
    nextTags = [...instance.tags, action.outputs.addsTag];
  }

  const updated: Instance = { entityId: instance.entityId, state: nextState, tags: nextTags };

  const spawned: Instance[] = [];
  if (action.outputs.spawnsTargetByproducts) {
    const byproductIds = target.byproductsByAction[action.id] ?? target.producedByproducts;
    for (const byproductId of byproductIds) {
      const byproductEntity = entities.get(byproductId);
      // Byproducts are pieces of the SAME original substance (egg ->
      // egg_yolk/white/shell) — a whole-substance safety property like
      // "pasteurized" legitimately carries to every piece, conservation-
      // of-mass style. Filtered against the byproduct entity's own
      // possibleTags so nothing nonsensical leaks through (e.g. a spawned
      // potato_peel never declares "flipped" as valid, so it can't
      // inherit it even if the parent somehow had it).
      const inheritable = nextTags.filter((t) => byproductEntity?.possibleTags?.includes(t));
      spawned.push({
        entityId: byproductId,
        state: byproductEntity?.possibleStates[0] ?? "raw",
        tags: inheritable,
      });
    }
  }
  if (action.outputs.combinesInto) {
    const combinedEntity = entities.get(action.outputs.combinesInto);
    // Merge tags from BOTH instances being combined — e.g. a salted beaten
    // egg combined with plain fried potato should leave the resulting
    // tortilla_mixture "salted" too. Same possibleTags filter as above.
    const mergedTags = [...new Set([...nextTags, ...(secondaryInstance?.tags ?? [])])];
    const inheritable = mergedTags.filter((t) => combinedEntity?.possibleTags?.includes(t));
    spawned.push({
      entityId: action.outputs.combinesInto,
      state: combinedEntity?.possibleStates[0] ?? "raw",
      tags: inheritable,
    });
  }
  // combinesInto implies both instances are gone, same conservation-of-mass
  // logic as destroysTarget but for two instances at once — see
  // ActionOutputsSchema.combinesInto's doc comment (action.ts).
  const destroyed = action.outputs.destroysTarget || !!action.outputs.combinesInto;
  const secondaryDestroyed = action.requiredSecondaryCapability !== undefined && secondaryInstance !== undefined;

  // Gated on durationSeconds actually being supplied, not merely on the
  // target having a criticalControlPointsByAction entry: durationSeconds is
  // an optional parameter, and CCP checking is opt-in along with it. A
  // caller that never passes a duration (or never loads/passes `ccps` at
  // all) sees zero behavior change — this must stay true for every
  // pre-existing call site that fries/pokes an egg without caring about
  // HACCP timing.
  const warnings: string[] = [];
  const durationRaw = params["durationSeconds"];
  if (durationRaw !== undefined) {
    const ccpId = target.criticalControlPointsByAction[action.id];
    if (ccpId) {
      const ccp = ccps.get(ccpId);
      if (!ccp) {
        throw new Error(
          `${action.verb} on "${target.id}" references unknown CriticalControlPoint "${ccpId}" — was ccps not loaded/passed into applyAction?`
        );
      }
      const seconds = Number(durationRaw);
      // Self-defending against malformed input, not just relying on the
      // parameters[] loop above having already validated durationSeconds as
      // a numericRange param: `NaN < ccp.heldSeconds` is FALSE in JS, so
      // without this guard a garbled duration would silently SKIP the
      // safety check entirely rather than fail it — the exact failure mode
      // this whole mechanism exists to prevent. That the parameters loop
      // currently always catches this first (every CCP-linked action
      // declares durationSeconds formally) is a convention, not an enforced
      // invariant; this check must not depend on that convention holding.
      if (Number.isNaN(seconds)) {
        throw new Error(`${action.verb} on "${target.id}": durationSeconds "${durationRaw}" is not a valid number — cannot verify the "${ccp.names.en}" threshold, so refusing to proceed.`);
      }

      // If this CCP has a real, computable thermal model AND the step
      // supplied an actual temperature (waterTempC), compute the required
      // hold time at THAT exact temperature instead of only ever checking
      // against the one fixed heldC/heldSeconds anchor — see
      // ThermalInactivationModelSchema's doc comment (thermal.ts) for the
      // real D/z-value math and its validity condition.
      let requiredSeconds = ccp.heldSeconds;
      let thresholdDescription = `${ccp.heldSeconds}s at ${ccp.heldC}°C (or ${ccp.instantaneousC}°C instantaneous)`;
      const waterTempRaw = params["waterTempC"];
      if (ccp.thermalModel && waterTempRaw !== undefined) {
        const actualTempC = Number(waterTempRaw);
        if (Number.isNaN(actualTempC)) {
          throw new Error(`${action.verb} on "${target.id}": waterTempC "${waterTempRaw}" is not a valid number — cannot compute the "${ccp.names.en}" threshold, so refusing to proceed.`);
        }
        requiredSeconds = requiredHoldSeconds(ccp.thermalModel, actualTempC);
        thresholdDescription =
          `${requiredSeconds.toFixed(1)}s, computed for the actual ${actualTempC}°C via thermal.ts's D/z model ` +
          `(reference ${ccp.thermalModel.referenceHoldSeconds}s @ ${ccp.thermalModel.referenceTempC}°C, z=${ccp.thermalModel.zValueC}°C — ${ccp.thermalModel.validityCondition})`;
      }

      if (seconds < requiredSeconds) {
        const msg = `${action.verb} on "${target.id}": ${seconds}s is below "${ccp.names.en}"'s minimum hold of ` + `${thresholdDescription} for ${ccp.pathogen}. ${ccp.source}`;
        const overridden = policy.mode === "autonomous" && policy.humanOverrides?.has(ccp.id) === true;
        if (ccp.advisoryOnly && (policy.mode === "human" || overridden)) {
          warnings.push(overridden ? `${msg} [autonomous mode: proceeding on explicit human override]` : msg);
        } else if (ccp.advisoryOnly) {
          // autonomous, not overridden: an advisory a human could judge for
          // themselves has no judge here, so the safe default is reject —
          // see SafetyPolicy's doc comment.
          throw new Error(`${msg} [autonomous mode: no human present to accept this risk — rejected by default; pass this CCP's id in humanOverrides to proceed]`);
        } else {
          throw new Error(msg);
        }
      }
    }
  }

  return { instance: updated, spawned, destroyed, secondaryDestroyed, warnings };
}
````

## File: ROADMAP.md
````markdown
# OCR Roadmap

## Why this exists

The concrete, non-abstract version of the goal: someone who cannot safely cook for
themselves — a wheelchair user without full reach/grip, someone recovering from
surgery, an elderly person living alone — should be able to have an actual cooked
meal made *for* them by a machine that follows real technique, not just reheats a
tray. That only works if "cook" is precise enough for a machine to execute and
honest enough not to fake the parts it can't yet do. Every "informational only, not
enforced" note and every "flagged, not built" gap in this codebase exists because
skipping that honesty would make the system *look* more capable than it is — which,
for something meant to actually cook unattended for a person who's relying on it,
is a worse failure mode than a visible gap. That's the standard this roadmap holds
itself to.

Derived from `CLAUDE_DEV_CTX.md` (see `CLAUDE.md`'s "Module layout" table for where
the implementation diverged from that original plan, and why). Phases below are
loosely ordered by dependency, not calendar date.

## Capability tests

The actual measure of progress: can the current vocabulary, run against the real
`src/engine.ts`, produce a specific real dish end-to-end? Empirically checked, not
reasoned about — run the script yourself. This matters more than phase checkboxes
below; a phase can be "done" on paper and still not add up to a real dish.

| Dish | Status | Script |
|---|---|---|
| Salted fried potatoes | ✅ Makeable | `npm run recipe -- salted_fried_potatoes` |
| Handmade alioli (egg-free, mortar) | ✅ Makeable | `npm run recipe -- handmade_alioli` |
| Handmade alioli (egg yolk) | ✅ Makeable | `npm run recipe -- handmade_alioli_egg_yolk` |
| Garlic oil potatoes | ✅ Makeable | `npm run recipe -- garlic_oil_potatoes` |
| **Tortilla de patatas (sin cebolla)** | ✅ **Makeable** (was ❌ blocked, closed 2026-08-12) | `npm run recipe -- tortilla_de_patatas` |
| Rührei (German-style scrambled eggs) | ✅ Makeable — **zero new vocabulary needed** | `npm run recipe -- ruhei` |
| Huevo frito (runny yolk, puntilla) | ✅ Makeable | `npm run recipe -- huevo_frito` |
| Tortilla francesa (flat, fully set) | ✅ Makeable | `npm run recipe -- tortilla_francesa` |
| French omelette (baveuse, folded) | ✅ Makeable | `npm run recipe -- french_omelette` |
| Soft-boiled egg (jammy, shocked, peeled) | ✅ Makeable | `npm run recipe -- soft_boiled_egg` |
| Tortilla de Betanzos (liquid, flowing center) | ✅ Makeable — **found and fixed a real HACCP gap** | `npm run recipe -- tortilla_de_betanzos` |
| Salt/pepper/chili, same potato (seasoning generalization) | ✅ Makeable, closed 2026-08-13 | `npm run capability-test:season-potato` |
| Boiled egg — gas vs. vitro vs. wood preheat time, doneness timing | ✅ Makeable, closed 2026-08-13 | `npm run capability-test:boil-egg-heat-sources` |

**Tortilla de Betanzos found a real bug: `tortilla_mixture.json` had ZERO
`criticalControlPointsByAction` wiring — the same class of gap
`handmade-alioli-egg-yolk.json` originally had.** Betanzos's defining trait is
an intentionally liquid, barely-set interior (the opposite end of
`internalTexture` from `tortilla_francesa.json`'s `fully_set`) — exactly the
FDA "increased risk, disclosed" case `egg_cooking.json` exists for, and it had
no safety check at all until asked whether this specific dish was makeable.
Fixed by reusing `egg_cooking.json` (same organism, same reasoning
`egg_cracked.json` already applies to FRY/SCRAMBLE) rather than inventing a
new CCP. Proven, not asserted: `tortilla_de_betanzos.json`'s two brief,
high-heat FRY steps (12s, 10s — genuinely below the 15s threshold, matching
the real technique) both trigger the advisory warning; `tortilla_de_patatas.
json`'s longer, gentler steps (180s, 120s) trigger none — same entity, same
COMBINE/FLIP machinery, now provably, not just nominally, different dishes.
Also found and fixed a second-order regression this caused:
`attempt-tortilla.ts`'s standalone demo never needed to load `ccps` before
(`tortilla_mixture` had no CCP to reference) — once it legitimately did, the
demo hit the exact self-defending "was ccps not loaded/passed?" error written
for this precise situation, correctly, not a bug in that check.

**`BOIL` had zero parameters, silently, until audited for it.** No
`durationSeconds`, no `yolkDoneness` — despite `egg.json` already wiring a CCP
to it that depends on exactly the first one. Fixed alongside a genuine,
previously-unmodeled culinary-physics gap: carryover cooking (a boiled egg
keeps cooking after leaving the pot; `durationSeconds` alone doesn't fix final
doneness). New `SHOCK` action (ice bath) gives an explicit lever to arrest it —
not a physics simulation, an honestly-scoped concrete instance of
`WORLD_MODEL.md`'s abstract "state is a derived classification of continuous
reality" point, showing up in an actual dish rather than a design doc.

**"Tortilla francesa" vs "French omelette" — a naming false-friend, not one dish.**
Same starting entity (`egg_cracked`), same `FRY` action — genuinely different result:
`tortilla_francesa.json` ends `tags: [salted]` (flat, `internalTexture: fully_set`,
never folded); `french_omelette.json` ends `tags: [salted, folded]` (`baveuse`,
`FOLD`ed). `fry.json`'s new `yolkDoneness`/`edgeStyle`/`internalTexture` params and
the new `FOLD` action (`egg_cracked.json`'s `isFoldable`) exist because the
previous vocabulary could only express ONE flat/set omelette, with no way to
represent the classical French technique or order a fried/poached egg by yolk
doneness — the actual most-common real-world order specification for either dish,
previously entirely unmodeled. OCR can represent both precisely now; it does not
and should not try to resolve which one a customer meant by the word "omelette"
— that's the LLM-intent layer's job (CONCEPT.md §14), not this schema's.

**Tortilla de patatas — originally blocked, checked and closed 2026-08-12.** The
two *components* were always makeable (fried potato via `PEEL`→`CUT`→`FRY`;
beaten salted egg via `CRACK`→`BEAT`→`SALT`); two specific, scoped gaps blocked
the dish itself, proven by a capability-test script trying and failing, not by
inspection:

1. ~~No verb combines two separate instances into one.~~ **Closed**: `COMBINE`
   (`data/actions/combine.json`) — `ActionOutputsSchema.combinesInto` +
   `ActionSchema.requiredSecondaryCapability` (`action.ts`), `applyAction`'s
   `secondaryInstance` param and `ExecutionResult.secondaryDestroyed`
   (`engine.ts`), `RecipeStepSchema.secondaryInstanceId` (`recipe.ts`) — a
   genuinely new engine mechanism, not a data-only fix. Fried potato + beaten
   egg both consumed; one new `tortilla_mixture` instance spawned in their
   place (`EntitySchema.structure.composite/components` finally populated —
   `["potato", "egg"]` — after existing unused since the first draft). Scoped
   deliberately narrow (this one specific pairing, fixed on one action
   definition), not a generic pair→result lookup system — see
   `combine.json`'s `scopeNote` for why that bigger design question is still
   open, not resolved here.
2. ~~No `FLIP` verb.~~ **Closed**: `FLIP` (`data/actions/flip.json`) —
   `addsTag: "flipped"`, mirroring `SALT`'s precedent rather than inventing a
   new state. Deliberately tool-agnostic (`pan` only) since a fried egg
   (spatula) and a whole tortilla (inverted onto a plate) flip by different
   physical motions for the same outcome — see `flip.json`'s
   `toolAndTechniqueGap` for what that leaves unmodeled.

Full run: `npm run recipe -- tortilla_de_patatas` (also `npm run
capability-test:tortilla` for the narrower step-by-step vocabulary check).
Neither fix touches robot control/perception (`ENGINE_INVARIANTS.md` #11 stays
separately true) — the vocabulary gap is closed; the physical-execution gap
was never this phase's job.

## Common culinary knowledge coverage

Started 2026-08-13 in response to a direct instruction to prioritize this
over engine work: "get all the common knowledge for cooking reflected in
system and schemas." Honest framing up front — "all" isn't achievable in one
pass (this repo has 5 seasoning/base ingredients total: potato, egg + its
byproducts, garlic, oil, salt/pepper/chili, water); this section exists so
progress is a checkable, prioritized list instead of an implied, unverifiable
"done." Same discipline as the capability-tests table above: closed items are
proven runnable, not just asserted.

**Closed:**
- [x] Salting timing (`before_cooking`/`during_cooking`/`after_cooking`,
      `salt.json`) — real osmosis/browning chemistry, informational-only.
- [x] Quantity (`QuantitySchema` — precise/imprecise/relative) — "a pinch,
      compared to what" answerable for the first time; see `ROADMAP.md`
      Phase 1.
- [x] Seasoning generalized beyond salt (`PEPPER`/`CHILI`) — see Phase 4
      above.
- [x] `SensoryPropertiesSchema.taste`'s missing "pungent" category (capsaicin/
      piperine/allicin — a real trigeminal channel, not a 6th basic taste but
      not representable by the other five either) — closed, applied to
      garlic/black_pepper/chili_flakes.
- [x] A real schema-integrity check that was previously silent: `addsTag`
      actions were never cross-checked against the target entity's own
      `possibleTags` — `scripts/validate.ts` now flags this (NOTE-level,
      proven to fire — see `LEARNINGS.md` 2026-08-13).
- [x] **Heat provider physics (gas/vitro/wood) + egg-boiling doneness
      timing** — closed 2026-08-13, `src/heat-source.ts` (`HeatSourceProfileSchema`,
      `estimatedPreheatSeconds`; `data/heat-sources/gas.json`, `vitro.json`,
      `wood_fire.json`) + `src/egg-doneness.ts` (`EGG_BOIL_DONENESS`, a real
      cited soft/medium/hard → seconds-range table). Gets the core physics
      right explicitly: heat source changes preheat TIME and control
      precision, never the boiling TEMPERATURE itself (always ~100°C at sea
      level — conflating the two is a real, common misconception this
      schema deliberately avoids). Also names, without modeling
      numerically, two real depth limits raised directly by the user:
      delivered heat is a genuine time-varying curve, not the constant
      average this uses; and a skilled cook's pan-positioning (essential on
      wood fire, where the fire itself often can't be finely dialed) is a
      real, separate control axis (`manualPositioningRelevance`) distinct
      from the source's own `controlPrecision`. Proven end-to-end:
      `npm run capability-test:boil-egg-heat-sources`.
- [x] Salt-in-boiling-water for egg (crack containment) — documented as a
      real, correctly-scoped gap rather than force-fit into `SALT`'s
      seasoning mechanism, which it isn't: `egg.json`'s new
      `crackContainmentNote` explains the real causal mechanism (faster
      coagulation of leaked white sealing a crack, not flavor) and
      explicitly does NOT endorse the commonly-repeated but weakly-evidenced
      "salt water peels easier" claim.

**Explicitly deferred, with the real reason why (not silently skipped):**
- [ ] Generalizing `SALT`/`PEPPER`/`CHILI` into one parameter-driven `SEASON`
      verb — needs a real engine feature (`addsTagFromParameter`, mirroring
      `transformedStateFromParameter`) plus a way for
      `requiredIngredientCapabilities` to identify WHICH specific instance
      satisfied the check, not just that one did. Out of scope while engine
      work is explicitly paused; the 3 separate verbs work correctly today.
- [ ] Salt/pepper crystal/grind size as distinct products (fine vs. coarse vs.
      kosher salt; whole vs. cracked vs. ground pepper is partially modeled —
      `black_pepper.json` starts "whole", `CRUSH` reaches "cracked"/"ground" —
      but salt itself is still one undifferentiated entity).

**Known-large, not yet started — flagged so the gap is visible, not implied
covered by what exists:**
- [ ] **Allergens.** Nothing in `EntitySchema` records allergen information at
      all (egg is a major allergen; nothing currently says so). Arguably the
      single highest-priority gap against this repo's own stated mission
      (`ROADMAP.md`'s "Why this exists" — cooking unattended for someone who's
      relying on the system): a system that can't say "this dish contains
      egg" is more dangerous by omission than one that's merely incomplete on
      technique.
- [ ] **Cross-contamination / hygiene knowledge.** `HazardSchema` models
      danger to the PERSON performing an action (a blade, hot oil); nothing
      models danger to the FOOD from equipment/surface reuse (same knife for
      raw egg then a ready-to-eat ingredient; a cutting board not washed
      between uses). `CriticalControlPointSchema` is thermal-only by design
      (see `LEARNINGS.md` 2026-08-12) — this would need a genuinely different
      mechanism, not a stretched CCP.
- [ ] **Far more staple ingredients/entities.** No flour, dairy (milk/butter/
      cheese), onion, herbs, sugar, vinegar/acid, or any protein besides egg.
      The vocabulary's technique DEPTH (HACCP, carryover cooking, emulsion
      chemistry) is disproportionate to its ingredient BREADTH right now.
- [ ] **More common technique verbs.** `SIMMER` (a real, distinct temperature
      band below a rolling `BOIL`), `WHISK`, `STEAM`, `ROAST`/`GRILL`,
      `MARINATE`, `REST` (post-cook carryover exists narrowly for egg via
      `SHOCK`, not generally), `KNEAD`, `STRAIN`/`DRAIN`.
- [ ] **Storage/shelf-life common knowledge** (partially, deliberately
      out-of-scope already for one case — `infuse.json`'s garlic-in-oil
      botulism note, `LEARNINGS.md` 2026-08-12 — but nothing general exists:
      no "how long is this safe/good for" anywhere).
- [ ] **Yield/waste factors** (edible-portion %, e.g. how much of a potato's
      mass a peel actually is) — `producedByproducts` records WHAT spawns,
      never HOW MUCH.

## Phase 0 — Project scaffolding
- [x] `package.json` + TypeScript toolchain — `tsx`, `tsc -p .`
- [x] Zod, confirmed as the schema/validation library
- [x] Test runner / unit tests — closed 2026-08-13. `node:test` (built into
      Node, no new dependency) + `tsx` as the loader (`npm test` →
      `node --import tsx --test tests/*.test.ts`), 44 assertions across
      `tests/{engine,action,thermal,ingredient}.test.ts` covering
      `applyAction`'s preconditions/outputs/conservation-of-mass/HACCP-CCP
      branches and the three schemas' `.refine()`s. `tests/` added to
      `tsconfig.json`'s `include` so `tsc --noEmit` typechecks it too.
      `scripts/validate.ts` (schema + cross-reference checks over the real
      `data/*.json`) and the demo/recipe scripts remain the complementary
      integration layer — this closes the *unit*-test gap specifically, not
      a replacement for either.
- [ ] Lint/format config — none present (no eslint/oxlint/prettier config in
      the repo).
- [x] `CLAUDE.md`'s "Repository state" — kept current as of this rewrite;
      see `CLAUDE.md`'s own instruction to update it *in the same change*
      that makes it stale, not later.

## Phase 1 — Core entity & ingestion models (`src/ingredient.ts`)
- [x] `EntitySchema` — ingredients vs. tools, capabilities, states, tags,
      `byproductsByAction`, `criticalControlPointsByAction` (both added
      beyond the original spec, out of necessity — see `LEARNINGS.md`
      2026-08-12).
- [x] `RecipeIngredientSchema` — closed 2026-08-13 as `QuantitySchema`
      (`src/ingredient.ts`) + `RecipeInstanceSchema.quantity` (`recipe.ts`),
      optional. A discriminated 3-kind union (`"precise"` amount+unit,
      `"imprecise"` a real culinary descriptor like "pinch"/"to_taste" with
      an optional non-authoritative gram range, `"relative"` a ratio
      against another entity in the same recipe, e.g. baker's-percentage
      salt) rather than one fraction/decimal field — a plain number would
      have misrepresented the ones that genuinely aren't reducible to one
      (see the schema's own doc comment for why). `scripts/validate.ts`
      cross-checks `"relative"`'s `ofEntityId` against the recipe's own
      `initialInventory`. Localized unit NAMES (e.g. "cucharadita" for tsp)
      deliberately not built — no other numeric-unit field in this repo
      localizes its unit string either, and nothing has asked for it yet.
      Still NOT wired into engine.ts/recipe-runner.ts execution — ingredients
      remain un-consumed/undecremented (Phase 4's own documented limit);
      this only lets a quantity be RECORDED, not enforced or scaled against.
- [ ] `ParsedIngredientSchema` — staging shape for raw scraper output. Not
      built (blocked on Phase 7 anyway).

## Phase 2 — Execution & safety models
No single `recipe-step.ts` — fragmented across three files as the engine grew
(see `CLAUDE.md`'s module-layout table for the full mapping).
- [ ] `EntityStateSchema` as originally specified — `engine.ts`'s `Instance`
      (`entityId`/`state`/`tags`) covers the same ground informally, not as
      a named, exported schema.
- [x] `CriticalControlPointSchema` — `src/thermal.ts`. °C not °F (spec says
      Fahrenheit; kept Celsius for consistency with the rest of the
      codebase). Two-point instantaneous/held model, not the FDA Food
      Code's full multi-point curve. Data: `data/ccps/egg_cooking.json`.
- [x] `MechanicalActionSchema` as originally specified — `src/action.ts`'s
      `ActionSchema`/`ActionOutputsSchema` covers this: tools, target
      capability, required ingredient capabilities, parameters (closed-enum
      **and**, since this session, continuous `numericRange` — duration,
      temperature), outputs (state change, tag, byproducts, destruction).

## Phase 3 — Compiled recipe container (`src/recipe.ts`)
- [x] `RecipeScriptSchema` — initial inventory + linear `sequence`. Built
      close to the original plan.
- [x] `src/recipe-runner.ts` (not in the original plan) — walks a
      `RecipeScript` against `engine.ts`, collects errors/warnings without
      halting on the first failure, handles `destroyed` instances and
      spawned byproducts.

## Phase 4 — Validation engine
- [ ] `OcrValidationEngine` class as a named class — `engine.ts`'s
      `applyAction` is a plain function covering most of the same
      responsibility (capability/tool/state-prerequisite checks).
- [ ] **`INVALID_TRANSITIONS` forbidden-state-transition matrix — still the
      single largest unbuilt piece of the original spec.** Nothing today
      stops e.g. peeling an already-boiled potato in general; only the
      specific `statePrerequisites` pairs authored per-entity (peel-before-
      cut, boiled-before-peel-egg, ...) are enforced. A real matrix would
      generalize this instead of requiring every forbidden pair to be
      individually authored.
- [x] Requirement checks before a step executes (tool/entity present,
      required state, required capabilities, parameter validity).
- [x] Conservation of mass/entities — `ActionOutputsSchema.destroysTarget` +
      `ExecutionResult.destroyed`, consumed by `recipe-runner.ts`. Scoped to
      this explicit per-action opt-in, not a general inventory-quantity
      decrement system.
- [x] HACCP CCP enforcement — `criticalControlPointsByAction` +
      `applyAction`'s `ccps` param. `durationSeconds` below a CCP's
      `heldSeconds` throws, or warns if `advisoryOnly`. Demo:
      `npm run demo:egg-haccp`.
- [x] **Autonomous/robot execution safety policy** (not in the original
      spec — added directly in response to "we are building a system that
      robots will use," `ENGINE_INVARIANTS.md` #11) — `engine.ts`'s
      `SafetyPolicy`: under `mode: "autonomous"`, an `advisoryOnly` CCP
      shortfall that would merely warn under human execution instead hard-
      rejects unless a human explicitly pre-authorized that specific CCP id.
      Explicitly scoped: this closes the HACCP-timing gap for autonomous
      execution, it does **not** make the rest of the engine robot-ready —
      see the next item.
- [x] **Multi-instance composition (`COMBINE` mechanism).** Closed
      2026-08-12 — see the capability-test section above for the full
      mechanism (`combinesInto`, `requiredSecondaryCapability`,
      `secondaryInstance`, `secondaryDestroyed`). `EntitySchema.structure.
      composite/components` is now populated for the first time
      (`tortilla_mixture.json`: `["potato", "egg"]`). Deliberately scoped to
      one fixed pairing per action definition, not a generic pair→result
      lookup — reusing fried garlic in a salad (`garlic-oil-potatoes.json`)
      is now mechanically possible the same way, but still needs its own
      action definition (a `salad` entity + the base ingredients it'd need,
      e.g. lettuce, don't exist yet) — not built speculatively here.
- [x] **Compound/named physical-manipulation actions beyond FRY/CUT/etc.**
      `FLIP` closed 2026-08-12 (`data/actions/flip.json`) — the
      proven-necessary case. Likely siblings (transferring a hot pan,
      plating, folding) remain unbuilt on purpose: the working method is
      "attempt a real dish, watch it fail, name the missing verb precisely"
      (`attempt-tortilla.ts` → `combine.json`/`flip.json` is the worked
      example), not pre-building speculatively. Next candidate dish should
      drive whatever's added next.
- [x] Unit tests per HACCP threshold — closed 2026-08-13 alongside Phase 0's
      test-runner gap; see `tests/engine.test.ts`'s "HACCP / CCP enforcement"
      suite (gating on `durationSeconds` presence, advisory-vs-hard-reject,
      `SafetyPolicy` human/autonomous/override branches, the `thermalModel`
      D/z-value path, the NaN-fails-closed guard).
- [x] **Seasoning verbs beyond SALT** — `PEPPER`/`CHILI` closed 2026-08-13
      (`data/actions/pepper.json`, `chili.json`; `data/entities/black_pepper.
      json`, `chili_flakes.json`), same shape as `SALT` (fixed `addsTag`,
      shared `timing` parameter), deliberately NOT generalized into one
      parameter-driven `SEASON` verb — see "Common culinary knowledge
      coverage" below for why, and what a real generalization would need.
      Proven end-to-end, including that `SALT` correctly rejects pepper as a
      substitute (`isSaltySeasoning` vs. the generic `isSeasoning` — a real
      precision gap the second seasoning entity would have silently opened),
      by `npm run capability-test:season-potato`.
- [ ] Unit tests per forbidden-transition rule — genuinely still blocked, but
      now on the `INVALID_TRANSITIONS` matrix itself not existing (this
      phase's own next unchecked item), not on the test-runner gap.
- [ ] **Real closed-loop control/perception layer for autonomous execution.**
      Explicitly out of scope for this repo as it stands — `engine.ts`'s own
      doc comment and `ENGINE_INVARIANTS.md` #11 are direct about this:
      every categorical parameter (`heatLevel`, `doneness`, `oilAdditionRate`,
      `curdSize`, `waterTempC`, `agitation`) is a human-readable technique
      hint, not a calibrated actuator command. `SafetyPolicy` governs what
      happens to a *stated* safety shortfall; it does not give the engine a
      way to *sense* temperature, doneness, or a person's hand near a knife.
      This is a large, separate body of work (sensing, motor control,
      calibration per physical rig) that a schema/validation repo like this
      one cannot substitute for — flagged clearly rather than implied away.

## Phase 4.5 — Goal-directed planning (`WORLD_MODEL.md`, new, 2026-08-12)
Resolves `CONCEPT.md`'s long-flagged fork (see that file's updated top note and
§12): the world is primary, a recipe is one layer of intent on top of it. Not
started — a real proposal, scoped honestly as substantial separate work, not
implied to be a small addition.
- [ ] `RecipeIntentSchema` (or similar) — goals/constraints/acceptable-states/
      tolerance/victory-conditions, replacing hand-authored `RecipeScript` as
      the AUTHORING format. `RecipeScriptSchema` itself doesn't go away — it
      becomes the planner's grounded output / a completed run's trace.
- [ ] An actual planner — searches `Action`'s existing precondition/effect
      shape (`requiredTargetCapability`/`requiredTools`/
      `requiredIngredientCapabilities`/`requiredSecondaryCapability` as
      preconditions; `outputs.*` as effects — already structurally a STRIPS/
      PDDL-style planning domain, just never driven that way) from current
      world state to a goal. Every `data/recipes/*.json` file today is a
      hand-computed example of exactly this search, done manually, one file
      at a time.
- [ ] Closed-loop / replanning execution mode, distinct from
      `recipe-runner.ts`'s current "log the failure, continue to the next
      step anyway" — correct for offline validation, actively wrong if ever
      reused verbatim to drive a real robot through a physical failure.
- [x] `VerificationCriterion`-per-action — closed 2026-08-12. `action.ts`'s
      `VerificationCriterionSchema` (method/description/confidence), audited
      onto all 21 actions, not left partial. Generalizes the CCP pattern (a
      sensor-checkable classification over a continuous quantity) beyond just
      HACCP. Still NOT a continuous-physics simulator or a closed loop —
      `engine.ts`'s `applyAction` doesn't consume this yet (still open-loop,
      asserts success the instant preconditions pass); this is the structured
      domain knowledge a real control loop would need, not the loop itself.
      `confidence: "low"` on several (EMULSIFY, BEAT, BAKE) is itself honest,
      useful information — it names exactly where "trust the timer" is
      weakest, not a defect quietly smoothed over.
- [x] Physical hazard metadata — closed alongside the above, not originally
      scoped as its own item but a direct answer to "think like a robot"'s
      named gap (this codebase only ever modeled FOOD safety via CCPs, never
      OPERATIONAL safety — a knife or hot oil endangering a person nearby).
      `action.ts`'s `HazardSchema` (type/severity/note), audited onto all 21
      actions (empty array is a real claim for SALT/BEAT, not an omission).
      Records what a real interlock/proximity-sensing system would need to
      know — doesn't itself keep anyone safe, no sensing exists.
- [x] `retrySafe` per action — what happens if a robot's fault-recovery
      blindly re-runs a step after an interruption. Auditing this FOUND a
      real bug, not a hypothetical one: `PEEL` neither `destroysTarget` nor
      checks it isn't already peeled — a blind retry would spawn a SECOND
      `potato_peel`/`egg_shell` byproduct instance that doesn't physically
      exist. `retrySafe: false` on `peel.json`, the only `false` among all 21.
      Two other real distinctions found and recorded, not just declared true:
      idempotent-by-construction (SALT/FLIP/FOLD/SHOCK/INFUSE/PASTEURIZE —
      engine.ts already guards `addsTag` against duplicates) vs. fails-loudly
      -instead-of-repeating (CRACK/SEPARATE/COMBINE — target already gone
      from inventory on a second attempt). `retrySafe: true` at the data/
      inventory level does NOT mean culinarily harmless — FRY/POACH/SCRAMBLE/
      EMULSIFY are flagged `true` with an explicit caveat that re-running a
      finished result risks overcooking or, for EMULSIFY specifically,
      breaking an already-stable emulsion.
- [x] **Real D-value/z-value thermal-death-time model — closed 2026-08-12,
      not part of the original Phase 4.5 scope but a direct answer to "make
      the system real, do the math, use standards."** `thermal.ts`'s
      `ThermalInactivationModelSchema` + `requiredHoldSeconds()`: the actual
      textbook microbiology formula the FDA Food Code's own multi-point
      tables were derived from — computes required hold time at ANY actual
      temperature from one cited reference point + a z-value, not just a
      fixed two-point lookup. Applied to a NEW CCP,
      `egg_pasteurization_liquid.json` (60°C/210s, a real USDA-cited
      regulated figure for already-liquid egg product) — explicitly NOT
      applied to the existing in-shell CCP, because the model's core
      assumption (product reaches medium temperature quickly) is false for a
      whole shelled egg. Computing what the model WOULD predict at the
      in-shell CCP's own 57°C (~975s) against its real empirical figure
      (3900s) surfaced a genuine ~4x gap — the measurable signature of shell
      heat-penetration lag, not asserted, calculated. Real payoff, not just
      rigor for its own sake: `handmade-alioli-egg-yolk.json`'s pasteurization
      step dropped from 65 minutes to 3.5, because pasteurizing the
      already-separated yolk directly is both MORE correct (right model for
      the right physical situation) and simpler (shorter, standards-backed,
      matches real commercial liquid-egg practice) — not a tradeoff between
      rigor and convenience.
- [ ] Structured `DomainFact`/`PhysicalProperty` records (typed value, unit,
      source, `verified: boolean`) alongside — not replacing — the prose
      `metadata.notes` this repo is full of. A robot's planner/verifier
      cannot safely consult an English paragraph for a safety-critical number
      at runtime; having anything interpret one to extract such a number
      (most obviously an LLM) is exactly what `ENGINE_INVARIANTS.md` #10
      forbids. `egg_cooking.json`'s `metadata.coagulationReferenceC` is the
      right instinct already present, just not yet a consistent, first-class
      pattern.
- [x] **A real domain-question query interface — closed 2026-08-12.**
      `src/query.ts`'s `answerAboutParameter` + `npm run ask -- <actionId>
      <parameterId>`: given a question like "how often should I pour olive
      oil for alioli," the answer comes from actually looking up
      `emulsify.json`'s `oilAdditionRate` (allowedValues, whether it's
      state-determining or informational, every metadata note that mentions
      it, every real recipe that has set it) — not generated prose. Matches
      CONCEPT.md §14's boundary exactly: turning free text into a structured
      lookup is the LLM's job; the deterministic data already in `data/*.json`
      has final say on the actual answer. Narrower than the `DomainFact`
      item above (this queries existing `metadata.notes` + parameter
      definitions as-is, not a new structured-fact schema) but real and
      running today, not just proposed.

## Phase 5 — Bi-directional compilers (`ocr-converter.ts`)
- [ ] `compileToSchemaOrgIngredient` and the OCR → Schema.org export path.
- [ ] Cooklang parser. Partial groundwork exists — every entity has a
      `cooklang: { canonicalToken, spiceLock }` field (`ajo`, `huevo`,
      `sal`, ...) — but nothing reads or writes actual `.cook` text yet.
- [ ] Cooklang scaling multipliers / spice-lock preservation.
- [ ] Cooklang ⇄ OCR JSON round-trip tests.

## Phase 6 — Nutrition extension (`nutrition-extension.ts`)
- [ ] `UsdaMealPatternContributionSchema`. Not started. Every entity already
      carries a `composition.nutrientsPer100g` record (water/protein/fat/
      carbohydrate, cited as literature approximations where not measured)
      that this would build on.

## Phase 7 — Satellite: Web scraper pipeline (Python / BeautifulSoup)
- [ ] Fetch a recipe URL, extract `<script type="application/ld+json">`.
- [ ] Tokenizer: lossy `recipeIngredient` strings → quantity/unit/name/prep.
- [ ] Auto-generate Cooklang text; compile to an executable OCR JSON script.
Unstarted; depends on Phase 5's Cooklang parser (or a Python equivalent) and
Phase 1's still-unbuilt `ParsedIngredientSchema` (`RecipeIngredientSchema`
itself closed 2026-08-13 — see Phase 1).

## Phase 8 — Satellite: Mobile reference app (React Native + Expo)
Unstarted. Depends on a stable OCR JSON shape (has one, informally, via
`data/*.json` + the Zod schemas) and a Community backend/auth service not yet
specified anywhere in this repo — flagged as an open dependency, not assumed.
- [ ] 4-tab navigator: Discover / Community / Meal Plan / Profile (per
      `CLAUDE_DEV_CTX.md`'s original spec — unchanged).

## Phase 9 — Satellite: Home Assistant HACS component (Python)
Unstarted. Depends on a running CookCLI server and a `.menu` file format
neither of which is defined anywhere in this repo — flagged, not assumed.

## Open dependencies / unknowns
- `.menu` file format (Phases 8 & 9) — still undefined anywhere.
- CookCLI server API surface (Phase 9) — still undefined.
- Community backend/auth service (Phase 8) — still undefined.
- The real shape of multi-instance composition (Phase 4's new top item) —
  a design decision, not just an implementation task.
- Whether `INVALID_TRANSITIONS` should be a literal static matrix (as
  `CLAUDE_DEV_CTX.md` specifies) or generalized from the `statePrerequisites`
  pattern already in use — unresolved, worth deciding before building either.
````

## File: package.json
````json
{
  "name": "ocr",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "Open Culinary Runtime — core schema and validation engine",
  "scripts": {
    "test": "node --import tsx --test tests/*.test.ts",
    "validate": "tsx scripts/validate.ts",
    "demo:wash-and-peel-potato": "tsx scripts/wash-and-peel-potato.ts",
    "demo:cut-potato": "tsx scripts/cut-potato.ts",
    "demo:reuse-potato-peel": "tsx scripts/reuse-potato-peel.ts",
    "demo:mix-potato-peel": "tsx scripts/mix-potato-peel.ts",
    "demo:cook-potato-three-ways": "tsx scripts/cook-potato-three-ways.ts",
    "demo:salted-boiled-potato": "tsx scripts/salted-boiled-potato.ts",
    "demo:separate-egg": "tsx scripts/separate-egg.ts",
    "demo:cook-egg-many-ways": "tsx scripts/cook-egg-many-ways.ts",
    "demo:egg-haccp": "tsx scripts/egg-haccp.ts",
    "demo:egg-pasteurization": "tsx scripts/egg-pasteurization.ts",
    "capability-test:tortilla": "tsx scripts/attempt-tortilla.ts",
    "capability-test:season-potato": "tsx scripts/season-potato-three-ways.ts",
    "capability-test:boil-egg-heat-sources": "tsx scripts/boil-egg-heat-sources.ts",
    "recipe": "tsx scripts/run-recipe.ts",
    "ask": "tsx scripts/ask.ts",
    "build": "tsc -p ."
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.7.5",
    "tsx": "^4.19.1",
    "typescript": "^5.6.3"
  }
}
````
