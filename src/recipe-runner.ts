import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import type { RecipeScript, RecipeStep } from "./recipe.ts";
import type { CriticalControlPoint } from "./thermal.ts";
import type { HeatSourceProfile } from "./heat-source.ts";
import { applyAction, type Instance, type SafetyPolicy } from "./engine.ts";
import {
  emptyPlace,
  pourInto,
  advanceTempSeconds,
  isAtTargetTemp,
  type PlaceState,
} from "./place.ts";
import {
  cleanTool,
  markContaminated,
  washTool,
  isRawContaminationRisk,
  type ToolContaminationState,
} from "./tool-hygiene.ts";

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
 *
 * PLACE STEPS (FILL / PLACE_IN / HEAT_PLACE) — added 2026-08-16, closing part
 * of ROADMAP.md's "Heat as a shared, time-varying property of a PLACE" entry:
 * `place.ts` gave a tool instance a real, persistent temperature back on
 * 2026-08-14, but deliberately stopped short of `engine.ts`/this file ever
 * consuming it — that file's own doc comment named exactly two things as
 * still open: no `FILL`/`PLACE` verb existed anywhere in `data/actions/*.json`,
 * and two ingredients in the same pot got independent, unlinked `applyAction`
 * calls, never one shared temperature. Both close here, deliberately scoped
 * NARROWER than the full roadmap entry, same "narrow it and say so" pattern
 * `place.ts` itself used:
 *
 * - Three new real verbs (`fill`, `place_in`, `heat_place`,
 *   `data/actions/*.json`) are recognized here and handled OUTSIDE
 *   `applyAction` entirely, not folded into its generic instantaneous
 *   state-transition model — `advanceTempSeconds` is fundamentally a
 *   continuous, elapsed-time process (this file's own `HEAT_PLACE` handler
 *   ticks it forward in fixed increments, polling `isAtTargetTemp`, the same
 *   idiom `scripts/boil-egg-as-a-robot.ts` already proved by hand), which
 *   `applyAction`'s "one precondition check, one immediate output" shape does
 *   not fit — see ROADMAP.md's adjacent, still-fully-open "transformations
 *   take time" entry for why that's a separate, larger gap this does NOT
 *   also close. `applyAction`'s own signature/behavior is completely
 *   unchanged by this addition.
 * - `places: Map<placeId, PlaceState>` and `placeContents: Map<placeId,
 *   instanceId[]>` are new, runner-local state, not a change to `Instance`
 *   (engine.ts) — an ingredient/tool's own state/tags still mean exactly
 *   what they meant before. This is genuinely the "co-located instances
 *   sharing state" concept the roadmap named as still-missing, scoped at the
 *   level it's actually true at: multiple food instances `PLACE_IN`'d into
 *   the same `placeId` see the literal same `PlaceState.currentTempC` after
 *   a `HEAT_PLACE` step, because there is exactly one `PlaceState` for that
 *   `placeId`, not one guess per `applyAction` call.
 * - Deliberately NOT claimed: the placed FOOD's own internal temperature is
 *   NOT computed or tracked by this — `places` models the MEDIUM (water/oil)
 *   a vessel holds, matching the user's own framing ("heat is a function
 *   inside a place where many ingredients can live") exactly; how fast heat
 *   penetrates the food itself is `heat-penetration.ts`'s separate, narrower
 *   (potato-only) concern, untouched by this change, not silently subsumed.
 * - Wired into the EXISTING precondition path only where a step opts in: a
 *   `boil`/`simmer` step's `params.placeId`, if set, requires that place to
 *   actually be at BOIL's boiling point / SIMMER's own declared `waterTempC`
 *   band (read off the action's own `parameters`, not a duplicated magic
 *   number) before `applyAction` runs at all — the concrete closure of
 *   `simmer.json`'s own `knownModelingGap` note ("doesn't actually know or
 *   enforce that the water is holding 85-96°C, only that the number a caller
 *   supplied falls in that band"). A step that doesn't set `params.placeId`
 *   is completely unaffected — every recipe authored before this change
 *   still runs identically; see `tests/recipe-runner.test.ts`.
 * - `FILL` does NOT remove the poured ingredient from `inventory` (unlike
 *   `destroysTarget` elsewhere) — water in a pot is still real, present
 *   water, not consumed/transformed the way SEPARATE consumes an egg; a
 *   step's existing `availableIngredientInstanceIds` presence check keeps
 *   working exactly as before, `places` is a strictly additional, parallel
 *   record of the SAME instance's real quantity/temperature, not a
 *   replacement for the existing (weaker) presence check.
 *
 * **`FRY`/oil CLOSED the same day, shortly after**: `requiredTargetCapability`/
 * `requiredToolCapabilities` on `fill`/`heat_place`/`place_in` generalized from
 * `isBoilingMedium`/`isDeepVessel` to a genuinely medium-agnostic `isPourable`/
 * `isVessel` (both water AND oil assert `isPourable`; pot/pan/saucepan/wok all
 * assert `isVessel` — see `oil.json`'s/`pot.json`'s own notes on each), and
 * `assertPlaceReady` gained a `fry` branch reading `fry.json`'s own declared
 * `oilTempC` numericRange minimum (same "read the declaration, don't duplicate
 * the number" discipline the `simmer` branch already used) — `place.ts`'s
 * `advanceTempSeconds` had supported oil generically since 2026-08-14
 * (`fry-egg-as-a-robot.ts`); this was purely the schema-level gate catching up.
 * Proven via `scripts/shared-pan-heat-as-a-robot.ts` (`npm run
 * capability-test:shared-pan-heat`) and `data/recipes/fried-egg-shared-pan.json`.
 *
 * **`PAR_FRY` CLOSED 2026-08-17**, extending the exact same branch rather than
 * duplicating it: `assertPlaceReady`'s condition is now `action.id === "fry" ||
 * action.id === "par_fry"`, and since it already reads the range off whichever
 * `Action` is actually passed in, `par-fry.json`'s own genuinely different
 * 145-165°C floor (vs. `fry.json`'s 120-200°C) is picked up correctly with zero
 * further branching. Proven via `scripts/par-fry-shared-pan-as-a-robot.ts`
 * (`npm run capability-test:par-fry-shared-pan`).
 *
 * Still NOT closed by this change, named rather than implied covered: no
 * `Instance.inProgressAction` or `toolLockBehavior`
 * (`WORLD_MODEL_OPTIMIZATION.md`'s design input, ROADMAP.md 2026-08-15); no
 * periodic/alternating-temperature recipe (the Di Lorenzo & Di Maio cited
 * "Periodic cooking of eggs" case) — `HEAT_PLACE` only ever moves toward ONE
 * target per step, alternating hot/cold would need repeated `HEAT_PLACE`
 * calls with different targets in sequence, which this DOES technically now
 * support mechanically but has not been proven against that real recipe.
 *
 * **`REMOVE` added 2026-08-16**, the fourth PLACE-shaped verb, closing
 * ROADMAP.md's own named "no verb for physically removing something from a
 * shared vessel" gap — the exact case `garlic-oil-potatoes.json`'s
 * `removalNote` names by id. `handleRemove` is `handlePlaceIn`'s direct
 * inverse: takes `step.targetInstanceId` out of `placeContents[placeId]`,
 * requires the place to exist AND the instance to actually currently be
 * there (a real, catchable authoring mistake otherwise), does not touch the
 * instance's own state/tags. Proven via `scripts/remove-from-place-as-a-
 * robot.ts` (`npm run capability-test:remove-from-place`). Deliberately
 * closes only the REMOVAL mechanism, not the adjacent, still-fully-open
 * "elapsed idle time causes doneness/burn consequences" half of the same
 * ROADMAP entry — see `remove.json`'s own `idleTimeScopeNote`.
 *
 * TOOL HYGIENE / CROSS-CONTAMINATION — added 2026-08-16, closing ROADMAP.md's
 * "Cross-contamination / hygiene knowledge" gap: a tool touching a raw,
 * contamination-risk ingredient (egg, `src/tool-hygiene.ts`'s
 * `isRawContaminationRisk`), then reused on other food with no
 * intervening wash, is a real food-safety risk `HazardSchema` (danger to
 * the PERSON) and `CriticalControlPointSchema` (thermal-only) both never
 * modeled. Mirrors the PLACE mechanism's own shape: a runner-local
 * `toolContamination: Map<string, ToolContaminationState>`, keyed by an
 * opt-in `params.toolInstanceId` a step may set (mirroring `placeId`'s
 * pattern exactly) — a step that never sets it is completely unaffected.
 * `WASH_TOOL` (`data/actions/wash_tool.json`) is special-cased like
 * `fill`/`place_in`/`heat_place`/`remove`, dispatched BEFORE the normal
 * `instance` resolution (its real target is never an `Instance`).
 * Contamination itself is NOT a special-cased verb — it's a pre-check +
 * post-update wrapped around the *existing* `applyAction` call, since it's
 * a discrete fact toggled by an ordinary instantaneous action (`CRACK`),
 * unlike `FILL`/`HEAT_PLACE`'s genuinely different continuous shape. An
 * explicit user decision: advisory only (`warnings`/`log`), not a hard
 * reject — mirrors `egg_cooking.json`'s `advisoryOnly: true` posture, not
 * `egg_pasteurization_raw.json`'s unconditional one; see
 * `tool-hygiene.ts`'s own doc comment for the full reasoning and what's
 * explicitly out of scope. Proven via `scripts/tool-hygiene-as-a-robot.ts`
 * (`npm run capability-test:tool-hygiene`).
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
  /** Every PLACE (pot/pan-as-filled) touched during this run, keyed by its
   *  recipe-local placeId — see this file's own top doc comment. Empty when
   *  the recipe never uses FILL. */
  places: Map<string, PlaceState>;
  /** Which instance ids were PLACE_IN'd into each placeId, in placement
   *  order — the concrete, checkable record of "these instances share one
   *  place's heat," not just an assertion. */
  placeContents: Map<string, string[]>;
  /**
   * Every spawned instance id's entity id, for the WHOLE run — including
   * ones later destroyed (e.g. combined into a `tortilla_mixture`) and so
   * no longer present in `finalInventory`. Added 2026-08-16 (TICKET 2,
   * `PAPER_NOTES_2608.04768.md`) directly because `recipe-explain.ts`'s
   * `explainRecipe` is deliberately execution-free and can only resolve a
   * `targetInstanceId` against `recipe.initialInventory` on its own — a
   * step targeting a SPAWNED instance (e.g. `PASTEURIZE` on
   * `egg_yolk-3`, `SEPARATE`'s own output) was silently unresolvable there.
   * A caller that already has a real `RecipeRunResult` (e.g.
   * `scripts/validate-recipe.ts`, which runs both) can pass this map into
   * `explainRecipe` to close that gap with REAL ground truth, not a second
   * static re-derivation of `spawnCounter`'s naming scheme (which would be
   * exactly the parallel-source-of-truth problem this file's own top doc
   * comment already warns against elsewhere). */
  spawnedEntityIds: Map<string, string>;
  /** Every tool instance touched via a step's opt-in `params.toolInstanceId`
   *  during this run, keyed by that toolInstanceId — see
   *  `src/tool-hygiene.ts`'s own top doc comment for the full mechanism.
   *  Empty when the recipe never sets `toolInstanceId` on any step. */
  toolContamination: Map<string, ToolContaminationState>;
}

function requireParam(
  params: Readonly<Record<string, string>>,
  key: string,
  actionVerb: string
): string {
  const value = params[key];
  if (value === undefined) {
    throw new Error(`${actionVerb} requires a "${key}" parameter.`);
  }
  return value;
}

function requireNumber(
  params: Readonly<Record<string, string>>,
  key: string,
  actionVerb: string
): number {
  const raw = requireParam(params, key, actionVerb);
  const num = Number(raw);
  if (Number.isNaN(num)) {
    throw new Error(`${actionVerb} got "${key}: ${raw}", which is not a valid number.`);
  }
  return num;
}

function numberOrDefault(
  params: Readonly<Record<string, string>>,
  key: string,
  fallback: number
): number {
  const raw = params[key];
  if (raw === undefined) return fallback;
  const num = Number(raw);
  if (Number.isNaN(num)) {
    throw new Error(`"${key}: ${raw}" is not a valid number.`);
  }
  return num;
}

function assertToolCapabilities(
  action: Action,
  availableTools: ReadonlySet<string>,
  entities: Map<string, Entity>
): void {
  for (const capability of action.requiredToolCapabilities) {
    const satisfied = [...availableTools].some(
      (id) => entities.get(id)?.capabilities[capability] === true
    );
    if (!satisfied) {
      throw new Error(
        `${action.verb} requires an available tool with capability "${capability}", but none is on hand.`
      );
    }
  }
}

function assertTargetCapability(action: Action, target: Entity): void {
  if (action.requiredTargetCapability) {
    const has = target.capabilities[action.requiredTargetCapability];
    if (has !== true) {
      throw new Error(
        `${action.verb} requires capability "${action.requiredTargetCapability}" on "${target.id}", but it is ` +
          `${has === false ? "explicitly false" : "unasserted"}.`
      );
    }
  }
}

/** FILL — pour a real, measured quantity of an ingredient (the instance
 *  named by `step.targetInstanceId`) into a place, creating the place if
 *  `params.placeId` hasn't been used yet. Thin wrapper over `place.ts`'s
 *  `pourInto`, which already rejects pouring into an occupied place. */
function handleFill(
  action: Action,
  step: RecipeStep,
  instance: Instance,
  entities: Map<string, Entity>,
  availableTools: ReadonlySet<string>,
  places: Map<string, PlaceState>,
  log: string[]
): void {
  const target = entities.get(instance.entityId);
  if (!target) {
    throw new Error(`Unknown entity "${instance.entityId}"`);
  }
  assertTargetCapability(action, target);
  assertToolCapabilities(action, availableTools, entities);

  const placeId = requireParam(step.params, "placeId", action.verb);
  const toolEntityId = requireParam(step.params, "toolEntityId", action.verb);
  const massKg = requireNumber(step.params, "massKg", action.verb);
  const startTempC = numberOrDefault(step.params, "startTempC", 20);

  const place = places.get(placeId) ?? emptyPlace(toolEntityId, startTempC);
  places.set(placeId, pourInto(place, instance.entityId, massKg, startTempC));
  log.push(
    `${action.verb} ${step.targetInstanceId} (${massKg}kg ${instance.entityId} @ ${startTempC}°C) into place "${placeId}" (${toolEntityId})`
  );
}

/** PLACE_IN — record that `step.targetInstanceId` is now physically located
 *  in an already-`FILL`ed place. Does not itself transform the placed
 *  instance's state (a later BOIL/SIMMER/FRY step against it still does
 *  that, exactly as before this addition existed) — this only establishes
 *  co-location, the fact `placeContents` and `HEAT_PLACE`'s shared-heat log
 *  line depend on. */
function handlePlaceIn(
  action: Action,
  step: RecipeStep,
  entities: Map<string, Entity>,
  availableTools: ReadonlySet<string>,
  places: Map<string, PlaceState>,
  placeContents: Map<string, string[]>,
  log: string[]
): void {
  assertToolCapabilities(action, availableTools, entities);

  const placeId = requireParam(step.params, "placeId", action.verb);
  const place = places.get(placeId);
  if (!place) {
    throw new Error(`${action.verb} requires place "${placeId}" to already exist — FILL it first.`);
  }

  const placementMethod = step.params.placementMethod;
  const allowedPlacementMethods = action.parameters.find(
    (p) => p.id === "placementMethod"
  )?.allowedValues;
  if (
    placementMethod !== undefined &&
    allowedPlacementMethods &&
    !allowedPlacementMethods.includes(placementMethod)
  ) {
    throw new Error(
      `${action.verb} got "placementMethod: ${placementMethod}", but only ${allowedPlacementMethods.join(", ")} are valid.`
    );
  }

  const contents = placeContents.get(placeId) ?? [];
  if (!contents.includes(step.targetInstanceId)) {
    contents.push(step.targetInstanceId);
  }
  placeContents.set(placeId, contents);
  log.push(
    `${action.verb} ${step.targetInstanceId} into place "${placeId}" (currently ${place.currentTempC.toFixed(1)}°C` +
      `${placementMethod ? `, ${placementMethod}` : ""}) — now shared by [${contents.join(", ")}]`
  );
}

/** REMOVE — the inverse of PLACE_IN: take `step.targetInstanceId` out of a
 *  place's shared contents, so it's no longer counted among the instances a
 *  later HEAT_PLACE step's shared heat applies to. Same "bookkeeping only,
 *  does not itself transform the instance's own state/tags" shape as
 *  PLACE_IN — a later cooking step against the same (now un-placed)
 *  instance still runs however it always would. */
function handleRemove(
  action: Action,
  step: RecipeStep,
  places: Map<string, PlaceState>,
  placeContents: Map<string, string[]>,
  log: string[]
): void {
  const placeId = requireParam(step.params, "placeId", action.verb);
  const place = places.get(placeId);
  if (!place) {
    throw new Error(`${action.verb} requires place "${placeId}" to already exist — FILL it first.`);
  }

  const removalMethod = step.params.removalMethod;
  const allowedRemovalMethods = action.parameters.find(
    (p) => p.id === "removalMethod"
  )?.allowedValues;
  if (
    removalMethod !== undefined &&
    allowedRemovalMethods &&
    !allowedRemovalMethods.includes(removalMethod)
  ) {
    throw new Error(
      `${action.verb} got "removalMethod: ${removalMethod}", but only ${allowedRemovalMethods.join(", ")} are valid.`
    );
  }

  const contents = placeContents.get(placeId) ?? [];
  if (!contents.includes(step.targetInstanceId)) {
    throw new Error(
      `${action.verb} cannot remove "${step.targetInstanceId}" from place "${placeId}" — it is not currently there ` +
        `(never PLACE_IN'd, or already removed). Currently in "${placeId}": [${contents.join(", ") || "nothing"}].`
    );
  }

  const remaining = contents.filter((id) => id !== step.targetInstanceId);
  placeContents.set(placeId, remaining);
  log.push(
    `${action.verb} ${step.targetInstanceId} from place "${placeId}" (currently ${place.currentTempC.toFixed(1)}°C` +
      `${removalMethod ? `, ${removalMethod}` : ""}) — now shared by [${remaining.join(", ") || "nothing"}]`
  );
}

/** WASH_TOOL — resets a tool instance's `ToolContaminationState` back to
 *  clean. See `data/actions/wash_tool.json`'s own notes for why this is a
 *  new special-cased verb (mirroring `fill`/`place_in`/`heat_place`/
 *  `remove`) rather than an extension of `wash.json`: its real target
 *  (`toolContamination.get(toolInstanceId)`) is never an `Instance`. */
function handleWashTool(
  action: Action,
  step: RecipeStep,
  toolContamination: Map<string, ToolContaminationState>,
  log: string[]
): void {
  const toolInstanceId = requireParam(step.params, "toolInstanceId", action.verb);
  const current = toolContamination.get(toolInstanceId) ?? cleanTool(toolInstanceId);
  toolContamination.set(toolInstanceId, washTool(current));
  log.push(
    current.contaminated
      ? `${action.verb} ${toolInstanceId}: was contaminated (by ${current.contaminatedByEntityId}, state "${current.contaminatedByState}") — now clean`
      : `${action.verb} ${toolInstanceId}: already clean`
  );
}

/** Fallback tick-count bound, used ONLY if `heat_place.json` somehow lacks
 *  `maxDurationSeconds` (action.ts, TICKET 2, PAPER_NOTES_2608.04768.md) —
 *  every real `data/actions/heat_place.json` has one as of 2026-08-16
 *  (1800s/30min, see its own `metadata.maxDurationSecondsNote`), so this is
 *  defensive dead code in practice, kept as a safety net rather than
 *  assuming the JSON will always carry the field. At the default 30s tick
 *  this is ~3.3 simulated hours, well past any real stovetop task — same
 *  defensive posture as engine.ts's NaN guards elsewhere in this codebase. */
const FALLBACK_MAX_HEAT_TICKS = 400;

/** HEAT_PLACE — advance a place's real, persistent temperature toward a
 *  target over real (simulated) elapsed time, ticking `place.ts`'s
 *  `advanceTempSeconds` forward and polling `isAtTargetTemp` exactly the
 *  way `scripts/boil-egg-as-a-robot.ts` already proved by hand — the actual
 *  mechanism a robot's own control loop needs, made a reusable, declarative
 *  recipe.sequence step instead of one-off procedural TypeScript. */
function handleHeatPlace(
  action: Action,
  step: RecipeStep,
  entities: Map<string, Entity>,
  availableTools: ReadonlySet<string>,
  heatSources: Map<string, HeatSourceProfile>,
  places: Map<string, PlaceState>,
  placeContents: Map<string, string[]>,
  log: string[]
): void {
  assertToolCapabilities(action, availableTools, entities);

  const placeId = requireParam(step.params, "placeId", action.verb);
  const place0 = places.get(placeId);
  if (!place0 || place0.contentsEntityId === null) {
    throw new Error(
      `${action.verb} requires place "${placeId}" to already exist and be filled — FILL it first.`
    );
  }
  const contentsEntity = entities.get(place0.contentsEntityId);
  if (!contentsEntity) {
    throw new Error(
      `${action.verb}: place "${placeId}" contains unknown entity "${place0.contentsEntityId}".`
    );
  }

  const heatSourceId = requireParam(step.params, "heatSourceId", action.verb);
  const heatSource = heatSources.get(heatSourceId);
  if (!heatSource) {
    throw new Error(
      `${action.verb} references unknown heat source "${heatSourceId}" — was heatSources not loaded/passed into runRecipe?`
    );
  }

  let targetTempC: number;
  if (step.params.targetTempC !== undefined) {
    targetTempC = Number(step.params.targetTempC);
    if (Number.isNaN(targetTempC)) {
      throw new Error(
        `${action.verb} got "targetTempC: ${step.params.targetTempC}", which is not a valid number.`
      );
    }
  } else if (contentsEntity.thermophysical?.boilingPointC !== undefined) {
    targetTempC = contentsEntity.thermophysical.boilingPointC;
  } else {
    throw new Error(
      `${action.verb}: "targetTempC" was not supplied and "${contentsEntity.id}" has no thermophysical.boilingPointC to default to.`
    );
  }

  const tickSeconds = numberOrDefault(step.params, "tickSeconds", 30);

  // TICKET 2 (execution-bounds.ts, PAPER_NOTES_2608.04768.md): the real
  // upper bound HEAT_PLACE times out against is now action.maxDurationSeconds
  // — a real, cited-or-house-valued seconds figure on the loaded Action —
  // not an arbitrary tick count. Falls back to the old tick-count bound only
  // if the action genuinely has no maxDurationSeconds set (see
  // FALLBACK_MAX_HEAT_TICKS's own doc comment).
  const maxElapsedSeconds = action.maxDurationSeconds ?? FALLBACK_MAX_HEAT_TICKS * tickSeconds;

  let place = place0;
  let elapsedSeconds = 0;
  let ticks = 0;
  while (!isAtTargetTemp(place, targetTempC)) {
    if (elapsedSeconds >= maxElapsedSeconds) {
      throw new Error(
        `${action.verb}: place "${placeId}" did not reach ${targetTempC}°C after ${elapsedSeconds}s (${ticks} ticks) — ` +
          `exceeded maxDurationSeconds (${maxElapsedSeconds}s); check heatSourceId/targetTempC.`
      );
    }
    place = advanceTempSeconds(place, heatSource, tickSeconds, contentsEntity, targetTempC);
    elapsedSeconds += tickSeconds;
    ticks++;
  }
  places.set(placeId, place);

  const coLocated = placeContents.get(placeId) ?? [];
  const sharedNote =
    coLocated.length > 0
      ? ` — shared by [${coLocated.join(", ")}], all now at the SAME ${place.currentTempC.toFixed(1)}°C`
      : "";
  log.push(
    `${action.verb} place "${placeId}" toward ${targetTempC}°C via ${heatSource.names.en}: reached ${place.currentTempC.toFixed(1)}°C in ${elapsedSeconds}s (${ticks} ticks)${sharedNote}`
  );
}

/** Opt-in cross-check for `boil`/`simmer` steps that set `params.placeId`:
 *  is this place ACTUALLY at temperature, not just "did the caller pass a
 *  plausible-looking waterTempC." Reads BOIL's real physical ceiling
 *  (`thermophysical.boilingPointC`) and SIMMER's own declared `waterTempC`
 *  numericRange (not a duplicated magic number) rather than inventing a
 *  third source of truth for either band. A step that never sets
 *  `params.placeId` never reaches this function at all. */
function assertPlaceReady(
  action: Action,
  placeId: string,
  places: Map<string, PlaceState>,
  entities: Map<string, Entity>
): void {
  const place = places.get(placeId);
  if (!place || place.contentsEntityId === null) {
    throw new Error(
      `${action.verb} references place "${placeId}", but it doesn't exist or hasn't been FILLed yet.`
    );
  }
  const contentsEntity = entities.get(place.contentsEntityId);

  if (action.id === "boil") {
    const boilingPointC = contentsEntity?.thermophysical?.boilingPointC;
    if (boilingPointC === undefined || place.currentTempC < boilingPointC) {
      throw new Error(
        `${action.verb} references place "${placeId}", but it's only at ${place.currentTempC.toFixed(1)}°C — not yet at ` +
          `${boilingPointC ?? "an unknown"}°C boiling. HEAT_PLACE it first.`
      );
    }
  } else if (action.id === "simmer") {
    const range = action.parameters.find((p) => p.id === "waterTempC")?.numericRange;
    if (range && (place.currentTempC < range.min || place.currentTempC > range.max)) {
      throw new Error(
        `${action.verb} references place "${placeId}", but it's at ${place.currentTempC.toFixed(1)}°C — outside SIMMER's own ` +
          `declared ${range.min}-${range.max}°C band. HEAT_PLACE it into range first.`
      );
    }
  } else if (action.id === "fry" || action.id === "par_fry") {
    // 2026-08-16, the oil/FRY generalization of the BOIL check above: no
    // single fixed "ready" temperature exists for oil the way boilingPointC
    // does for water (a real, distinct KIND of true — see place.ts's own
    // doc comment) — read the action's OWN declared oilTempC numericRange's
    // MINIMUM off the loaded action, same "don't duplicate the number"
    // discipline the SIMMER branch above already uses, rather than
    // hardcoding a threshold a second time. `action` here is whichever of
    // FRY/PAR_FRY is actually running, so this one branch already reads the
    // right range for either — no duplicated per-verb logic needed, since
    // `par_fry.json`'s own 145-165°C floor genuinely differs from `fry.json`'s
    // 120-200°C one (a real, deliberate difference, not an oversight — PAR_FRY
    // closed 2026-08-17, extending 2026-08-16's FRY/oil wiring to the verb
    // that same day's own closing note named as still open).
    const range = action.parameters.find((p) => p.id === "oilTempC")?.numericRange;
    if (range && place.currentTempC < range.min) {
      throw new Error(
        `${action.verb} references place "${placeId}", but it's only at ${place.currentTempC.toFixed(1)}°C — below ${action.verb}'s own ` +
          `declared ${range.min}°C minimum. HEAT_PLACE it first.`
      );
    }
  }
}

export function runRecipe(
  recipe: RecipeScript,
  entities: Map<string, Entity>,
  actions: Map<string, Action>,
  ccps: Map<string, CriticalControlPoint> = new Map(),
  policy?: SafetyPolicy,
  heatSources: Map<string, HeatSourceProfile> = new Map()
): RecipeRunResult {
  const inventory = new Map<string, Instance>();
  for (const item of recipe.initialInventory) {
    inventory.set(item.id, { entityId: item.entityId, state: item.state, tags: [...item.tags] });
  }

  const availableTools = new Set(recipe.availableTools);
  const log: string[] = [];
  const errors: RecipeStepError[] = [];
  const warnings: string[] = [];
  const places = new Map<string, PlaceState>();
  const placeContents = new Map<string, string[]>();
  const spawnedEntityIds = new Map<string, string>();
  const toolContamination = new Map<string, ToolContaminationState>();
  let spawnCounter = 0;

  for (const step of recipe.sequence) {
    const action = actions.get(step.actionId);

    if (!action) {
      errors.push({ step, message: `Unknown action "${step.actionId}"` });
      continue;
    }

    // WASH_TOOL — dispatched before the `instance` bail-out below, because
    // (per the authoring convention named in wash_tool.json's own notes)
    // its real target is a ToolContaminationState, keyed by
    // params.toolInstanceId, never an inventory Instance — targetInstanceId
    // is set to the same toolInstanceId by convention, but not resolved
    // against `inventory` at all. Kept a separate branch from the PLACE
    // steps below (not folded into that list) since, unlike those, this
    // touches neither `Instance` nor `places`.
    if (action.id === "wash_tool") {
      try {
        handleWashTool(action, step, toolContamination, log);
      } catch (err) {
        const message = (err as Error).message;
        errors.push({ step, message });
        log.push(`REJECTED ${action.verb} ${step.targetInstanceId}: ${message}`);
      }
      continue;
    }

    const instance = inventory.get(step.targetInstanceId);
    if (!instance) {
      errors.push({ step, message: `Unknown target instance "${step.targetInstanceId}"` });
      continue;
    }

    // PLACE STEPS — handled entirely outside applyAction's generic
    // instantaneous-transition model; see this file's own top doc comment.
    if (
      action.id === "fill" ||
      action.id === "place_in" ||
      action.id === "heat_place" ||
      action.id === "remove"
    ) {
      try {
        if (action.id === "fill") {
          handleFill(action, step, instance, entities, availableTools, places, log);
        } else if (action.id === "place_in") {
          handlePlaceIn(action, step, entities, availableTools, places, placeContents, log);
        } else if (action.id === "remove") {
          handleRemove(action, step, places, placeContents, log);
        } else {
          handleHeatPlace(
            action,
            step,
            entities,
            availableTools,
            heatSources,
            places,
            placeContents,
            log
          );
        }
      } catch (err) {
        const message = (err as Error).message;
        errors.push({ step, message });
        log.push(`REJECTED ${action.verb} ${step.targetInstanceId}: ${message}`);
      }
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

    // Same "unknown id -> loud step error" treatment targetInstanceId/
    // secondaryInstanceId already get above, applied here for the identical
    // reason — a typo'd/stale availableIngredientInstanceIds entry used to
    // be silently dropped from the Set instead, which could mask a real
    // authoring mistake in TWO ways: the step could still pass (if some
    // OTHER listed instance happened to satisfy requiredIngredientCapabilities
    // anyway, hiding that the intended one was never actually checked) or
    // fail with a generic "no qualifying ingredient on hand" error that
    // never named the actual typo as the cause. A stale reference to an
    // instance id that was never declared/spawned is always an authoring
    // bug, never a legitimate state — worth failing loudly every time, not
    // only on the runs where it happens to matter.
    const availableIngredientEntityIds = new Set<string>();
    let hasUnknownIngredientInstance = false;
    for (const id of step.availableIngredientInstanceIds) {
      const ingredientInstance = inventory.get(id);
      if (!ingredientInstance) {
        errors.push({
          step,
          message: `Unknown ingredient instance "${id}" in availableIngredientInstanceIds`,
        });
        hasUnknownIngredientInstance = true;
        continue;
      }
      availableIngredientEntityIds.add(ingredientInstance.entityId);
    }
    if (hasUnknownIngredientInstance) {
      continue;
    }

    // Opt-in real-place readiness check (2026-08-16) — see
    // assertPlaceReady's own doc comment. Only reached when the step itself
    // names a placeId; every step that doesn't is completely unaffected.
    if (step.params.placeId) {
      try {
        assertPlaceReady(action, step.params.placeId, places, entities);
      } catch (err) {
        const message = (err as Error).message;
        errors.push({ step, message });
        log.push(`REJECTED ${action.verb} ${step.targetInstanceId}: ${message}`);
        continue;
      }
    }

    // Opt-in tool-hygiene pre-check (2026-08-16) — see tool-hygiene.ts's own
    // doc comment. Advisory only (an explicit user decision, not a hard
    // reject like egg_pasteurization_raw.json's): the step still proceeds
    // to applyAction either way. A step that never sets
    // params.toolInstanceId never reaches this, same opt-in gating as the
    // placeId check above.
    if (step.params.toolInstanceId) {
      const existing = toolContamination.get(step.params.toolInstanceId);
      if (existing?.contaminated) {
        const message =
          `${action.verb} reuses "${step.params.toolInstanceId}" without washing it first — ` +
          `contaminated by contact with "${existing.contaminatedByEntityId}" (state "${existing.contaminatedByState}"). ` +
          `WASH_TOOL it before reusing on other food.`;
        warnings.push(message);
        log.push(`  WARNING: ${message}`);
      }
    }

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
      // Post-update: does contact with THIS target (its state BEFORE the
      // action ran — what the tool actually touched, not what it became)
      // mark the named tool instance contaminated? See
      // tool-hygiene.ts's isRawContaminationRisk.
      if (step.params.toolInstanceId) {
        const target = entities.get(instance.entityId);
        if (target && isRawContaminationRisk(target, instance.state)) {
          const current =
            toolContamination.get(step.params.toolInstanceId) ??
            cleanTool(step.params.toolInstanceId);
          toolContamination.set(
            step.params.toolInstanceId,
            markContaminated(current, target.id, instance.state)
          );
          log.push(
            `  ${step.params.toolInstanceId} contaminated by contact with ${target.id} (state "${instance.state}") — WASH_TOOL required before reuse.`
          );
        } else if (!toolContamination.has(step.params.toolInstanceId)) {
          toolContamination.set(step.params.toolInstanceId, cleanTool(step.params.toolInstanceId));
        }
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
        log.push(
          `  consumed secondary instance ${step.secondaryInstanceId} (${secondaryInstance!.entityId})`
        );
      }
      for (const spawned of result.spawned) {
        const spawnedId = `${spawned.entityId}-${++spawnCounter}`;
        inventory.set(spawnedId, spawned);
        spawnedEntityIds.set(spawnedId, spawned.entityId);
        log.push(`  spawned ${spawnedId} (${spawned.entityId}, state: "${spawned.state}")`);
      }
    } catch (err) {
      const message = (err as Error).message;
      errors.push({ step, message });
      log.push(`REJECTED ${action.verb} ${step.targetInstanceId}: ${message}`);
    }
  }

  return {
    finalInventory: inventory,
    errors,
    log,
    warnings,
    places,
    placeContents,
    spawnedEntityIds,
    toolContamination,
  };
}
