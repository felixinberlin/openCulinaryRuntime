import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import type { RecipeInstance } from "./recipe.ts";
import { importCooklangDraft, normalizeToken, type CooklangStep } from "./cooklang.ts";

/**
 * The prose-to-verb translator `AUTHORING.md` §2 (point 2) and
 * `ROADMAP.md` Phase 5 both named as the one piece of Cooklang support
 * that ISN'T mechanical — `cooklang.ts`'s own top doc comment draws the
 * same line. This module does not cross it: it is a real, bounded,
 * DETERMINISTIC keyword/allowed-value matcher over this repo's own closed
 * action vocabulary (`data/actions/*.json`'s `verb`/`names`/`parameters`),
 * not an NLP model and not an LLM call — this repo has never called an
 * external LLM API anywhere in its execution path (`package.json`'s only
 * dependency is `zod`), and this module keeps that property. Exactly the
 * same "deterministic data already in `data/*.json` has final say" ethos
 * `query.ts`'s `answerAboutParameter` already runs on, applied in the
 * opposite direction: there, free text IN is a question about a known
 * parameter; here, free text IN is a step's prose, matched against the
 * same closed, typed vocabulary.
 *
 * **What this buys, honestly**: recognizing a verb this repo already
 * knows about (by its `verb` id or any locale in `names`), inferring
 * `durationSeconds` from an already-parsed Cooklang timer, and inferring
 * an `allowedValues` parameter from a literal value string appearing in
 * the prose (e.g. "high" for `heatLevel`) — all real, all traceable back
 * to a specific match, never guessed silently. **What this does NOT
 * attempt**, on purpose, matching this repo's own restraint elsewhere:
 * numeric-range parameters (`oilTempC`, `waterTempC`, ...) are never
 * extracted from prose — there is no reliable, non-guessing way to read
 * "175 degrees" out of free text against a parameter this repo hasn't
 * already tokenized (Cooklang has no `%degrees_c` convention), so those
 * are always left for a human/LLM to fill in, named as a missing
 * required parameter rather than invented. A step with more than one
 * recognized verb (`"Peel and crush @ajo"`) only becomes ONE
 * `RecipeStep`, matching the FIRST verb found — clause-splitting free
 * text reliably is exactly the kind of judgment call this module
 * deliberately doesn't make; the second verb is named in that step's own
 * `notes`, not silently dropped.
 *
 * Every translation is a PROPOSAL — see `recipe-scaffold.ts`'s identical
 * precedent: `translateCooklangDocument`'s `draft` is a plain,
 * `RecipeScript`-SHAPED object, never parsed against `RecipeScriptSchema`
 * here, and often genuinely schema-invalid (an unmatched step contributes
 * no `sequence` entry at all). The real hand-off is `AUTHORING.md` §1's
 * existing `validate-recipe` loop — this module's whole job ends at
 * producing a first, honestly-imperfect draft for that loop to react to.
 */

const TIME_UNIT_SECONDS: Record<string, number> = {
  s: 1,
  sec: 1,
  secs: 1,
  second: 1,
  seconds: 1,
  min: 60,
  mins: 60,
  minute: 60,
  minutes: 60,
  h: 3600,
  hr: 3600,
  hrs: 3600,
  hour: 3600,
  hours: 3600,
};

function timerToSeconds(amount: number, unit: string | undefined): number | undefined {
  if (unit === undefined) return undefined;
  const factor = TIME_UNIT_SECONDS[unit.toLowerCase()];
  return factor === undefined ? undefined : amount * factor;
}

/** Escapes a string for safe use inside a `RegExp`. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface VerbMatch {
  /** Every actionId this alias resolves to — usually one, but a real gap
   *  this repo's own data has (`combine.json`/`combine_dough.json`/
   *  `combine_potato_onion.json`/`combine_con_cebolla.json` all share the
   *  identical verb `COMBINE`) means a bare alias can genuinely be
   *  ambiguous among several distinct actions. Kept as an array rather
   *  than collapsed to one (last-write-wins would have silently picked
   *  an arbitrary one of the four and been wrong most of the time) —
   *  `translateStep` reports the ambiguity instead of guessing among
   *  them, same as an ambiguous `allowedValues` match below. */
  actionIds: string[];
  matchedText: string;
  index: number;
}

/** One entry per normalized alias -> every actionId that alias could mean,
 *  built from every action's `verb` and every locale in its `names` — a
 *  step authored in Spanish ("Freír @patata") matches exactly as well as
 *  one authored in English ("Fry @patata"), since `names.es` is indexed
 *  too, not just `names.en`. */
function buildVerbIndex(actions: Map<string, Action>): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const add = (alias: string, actionId: string) => {
    const key = normalizeToken(alias);
    const existing = index.get(key);
    if (existing) {
      if (!existing.includes(actionId)) existing.push(actionId);
    } else {
      index.set(key, [actionId]);
    }
  };
  for (const action of actions.values()) {
    add(action.verb, action.id);
    for (const name of Object.values(action.names)) add(name, action.id);
  }
  return index;
}

/** Finds every alias from `verbIndex` that appears in `text` as a whole
 *  word, in order of first appearance. Longer aliases are tried first at
 *  each scan so e.g. a specific multi-word name ("Combine (potato +
 *  onion)") wins over a shared bare verb ("Combine") when both are
 *  present as aliases and the more specific one is actually in the text —
 *  the one real way this module resolves what would otherwise be a
 *  `VerbMatch.actionIds` ambiguity. */
function findVerbMatches(text: string, verbIndex: Map<string, string[]>): VerbMatch[] {
  const aliases = [...verbIndex.keys()].sort((a, b) => b.length - a.length);
  const matches: VerbMatch[] = [];
  const claimed: [number, number][] = []; // [start, end) ranges already matched
  for (const alias of aliases) {
    if (alias === "") continue;
    // Lookaround-based boundary rather than `\b`: `\b` only asserts where a
    // WORD character (`\w`) meets a non-word one, which silently fails to
    // match at all when the alias itself ENDS in punctuation — a real case
    // in this repo's own data (combine_dough.json's real name is "Combine
    // (flour + water)", ending in ")"; `\bcombine \(flour \+ water\)\b`
    // never matches because ")" followed by a space is non-word-to-non-word,
    // no boundary there for `\b` to assert). Checking "the character just
    // outside the match isn't alphanumeric" instead works regardless of
    // what character the alias itself starts/ends with.
    const re = new RegExp(`(?<![A-Za-z0-9_])${escapeRegExp(alias)}(?![A-Za-z0-9_])`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const overlaps = claimed.some(([cs, ce]) => start < ce && end > cs);
      if (!overlaps) {
        claimed.push([start, end]);
        matches.push({ actionIds: verbIndex.get(alias)!, matchedText: m[0], index: start });
      }
    }
  }
  matches.sort((a, b) => a.index - b.index);
  return matches;
}

export interface TranslatedStepCandidate {
  /** The source Cooklang step text this was derived from, verbatim. */
  sourceText: string;
  /** Set only when a recognized verb was found in the step's text. */
  actionId?: string;
  /** The literal text that matched the action's verb/name — for a human
   *  reviewing the draft to see exactly why this action was picked. */
  matchedVerb?: string;
  targetInstanceId?: string;
  /** Set only for an action with `requiredSecondaryCapability` (a
   *  COMBINE-shaped action) when a second resolvable ingredient reference
   *  was present in the step — still a guess, always noted as one. */
  secondaryInstanceId?: string;
  availableIngredientInstanceIds: string[];
  params: Record<string, string>;
  /** Real, named gaps/ambiguities in THIS step's translation — nothing
   *  here is silently hidden from whoever reviews the draft next. */
  notes: string[];
}

export interface CooklangTranslationDraftStep {
  actionId: string;
  targetInstanceId: string;
  params: Record<string, string>;
  availableIngredientInstanceIds: string[];
  secondaryInstanceId?: string;
}

/** A plain object matching `RecipeScriptSchema`'s SHAPE — same "not a
 *  real `RecipeScript`, never `.parse()`d here" reasoning as
 *  `recipe-scaffold.ts`'s `RecipeScaffold`. `sequence` can be empty (no
 *  step recognized any verb at all) exactly like a fresh scaffold's
 *  empty `sequence` — schema-invalid by construction, an honest starting
 *  point, not a bug. */
export interface CooklangTranslationDraft {
  id: string;
  names: { en: string };
  initialInventory: RecipeInstance[];
  availableTools: string[];
  sequence: CooklangTranslationDraftStep[];
  metadata: { notes: string };
}

export interface CooklangTranslation {
  draft: CooklangTranslationDraft;
  /** One entry per source Cooklang step, in order — INCLUDING steps that
   *  produced no `sequence` entry, so nothing is silently dropped. */
  stepTranslations: TranslatedStepCandidate[];
  /** Carried through from `importCooklangDraft` — ingredient tokens that
   *  matched no known entity at all. */
  unresolvedIngredientTokens: string[];
}

function translateStep(
  step: CooklangStep,
  tokenToInstanceId: Map<string, string>,
  actions: Map<string, Action>,
  verbIndex: Map<string, string[]>
): TranslatedStepCandidate {
  const notes: string[] = [];
  const verbMatches = findVerbMatches(step.text, verbIndex);

  if (verbMatches.length === 0) {
    return {
      sourceText: step.text,
      availableIngredientInstanceIds: [],
      params: {},
      notes: ["no recognized action verb found in this step's text"],
    };
  }

  const primaryIndex = verbMatches.findIndex((m) => m.actionIds.length === 1);
  if (primaryIndex === -1) {
    // Every recognized verb in this step is itself ambiguous among several
    // real actions — e.g. plain "Combine" (combine.json/combine_dough.json/
    // combine_potato_onion.json/combine_con_cebolla.json all share the
    // identical verb COMBINE). Reported, not guessed among — silently
    // picking one would be wrong most of the time by construction.
    const ambiguous = verbMatches
      .map((m) => `"${m.matchedText}" -> one of [${m.actionIds.join(", ")}]`)
      .join("; ");
    return {
      sourceText: step.text,
      availableIngredientInstanceIds: [],
      params: {},
      notes: [`ambiguous action verb(s), not guessed among: ${ambiguous}`],
    };
  }

  const primary = verbMatches[primaryIndex];
  const action = actions.get(primary.actionIds[0])!;
  for (const [i, extra] of verbMatches.entries()) {
    if (i === primaryIndex) continue;
    if (extra.actionIds.length > 1) {
      notes.push(
        `ambiguous verb "${extra.matchedText}" elsewhere in this step's text (could be one of ` +
          `[${extra.actionIds.join(", ")}]) was not translated`
      );
    } else if (extra.actionIds[0] !== action.id) {
      notes.push(
        `additional recognized verb "${extra.matchedText}" (${extra.actionIds[0]}) was not translated — ` +
          "this module only produces one RecipeStep per Cooklang step; split this line if you meant two steps"
      );
    }
  }

  // Ingredient references in THIS step, resolved to recipe-local instance
  // ids, in the order they appear in the text.
  const resolvedInStep: string[] = [];
  for (const ref of step.ingredients) {
    const instanceId = tokenToInstanceId.get(normalizeToken(ref.token));
    if (instanceId && !resolvedInStep.includes(instanceId)) resolvedInStep.push(instanceId);
  }
  if (resolvedInStep.length === 0) {
    notes.push(
      `matched action "${action.id}" but no ingredient reference in this step resolved to a known entity`
    );
  }

  const targetInstanceId = resolvedInStep[0];
  const rest = resolvedInStep.slice(1);
  let secondaryInstanceId: string | undefined;
  let availableIngredientInstanceIds = rest;
  if (action.requiredSecondaryCapability && rest.length > 0) {
    secondaryInstanceId = rest[0];
    availableIngredientInstanceIds = rest.slice(1);
    notes.push(
      `"${action.id}" requires a secondary instance (requiredSecondaryCapability) — guessed "${secondaryInstanceId}" ` +
        "from this step's ingredient order; confirm this is really the intended second instance"
    );
  }

  const params: Record<string, string> = {};
  const durationParam = action.parameters.find((p) => p.id === "durationSeconds");
  if (durationParam) {
    const timer = step.timers[0];
    const seconds = timer
      ? timerToSeconds(timer.quantity.amount ?? NaN, timer.quantity.unit)
      : undefined;
    if (seconds !== undefined && !Number.isNaN(seconds)) {
      params.durationSeconds = String(seconds);
    } else if (durationParam.required) {
      notes.push(
        'required parameter "durationSeconds" not found — no ~{...} timer in this step\'s text'
      );
    }
  }

  for (const param of action.parameters) {
    if (param.id === "durationSeconds" || !param.allowedValues) continue;
    const found = param.allowedValues.filter((value) => {
      const spaced = value.replace(/[_-]+/g, " ");
      return new RegExp(`\\b${escapeRegExp(spaced)}\\b`, "i").test(
        step.text.replace(/[_-]+/g, " ")
      );
    });
    if (found.length === 1) {
      params[param.id] = found[0];
    } else if (found.length > 1) {
      notes.push(
        `ambiguous parameter "${param.id}": both ${found.map((v) => `"${v}"`).join(" and ")} appear in the text`
      );
    } else if (param.required) {
      notes.push(
        `required parameter "${param.id}" not found in this step's text (allowed: ${param.allowedValues.join(", ")})`
      );
    }
  }
  for (const param of action.parameters) {
    if (param.numericRange && param.required && !(param.id in params)) {
      notes.push(
        `required numeric parameter "${param.id}" (${param.numericRange.unit}) cannot be read from prose — set it by hand`
      );
    }
  }

  if (targetInstanceId === undefined) {
    notes.push(`no target instance resolved — this step will NOT appear in the draft's sequence`);
  }

  return {
    sourceText: step.text,
    actionId: action.id,
    matchedVerb: primary.matchedText,
    targetInstanceId,
    secondaryInstanceId,
    availableIngredientInstanceIds,
    params,
    notes,
  };
}

function slugToId(slug: string): string {
  return slug.replace(/[-\s]+/g, "_").toLowerCase();
}

function slugToDisplayName(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Parses `source`, resolves ingredients against `entities` (reusing
 * `importCooklangDraft` rather than re-deriving that matching a second
 * time), and best-effort-translates each step's prose into a candidate
 * `RecipeStep` against `actions`' real, closed vocabulary. Always returns
 * — never throws on an untranslatable step; see this file's top doc
 * comment for exactly what is and isn't attempted, and why.
 */
export function translateCooklangDocument(
  source: string,
  slug: string,
  entities: Map<string, Entity>,
  actions: Map<string, Action>
): CooklangTranslation {
  const importDraft = importCooklangDraft(source, entities);

  const tokenToInstanceId = new Map<string, string>();
  importDraft.resolvedIngredients.forEach((r, i) => {
    tokenToInstanceId.set(normalizeToken(r.ref.token), importDraft.proposedInventory[i].id);
  });

  const verbIndex = buildVerbIndex(actions);

  const stepTranslations = importDraft.steps.map((step) =>
    translateStep(step, tokenToInstanceId, actions, verbIndex)
  );

  const sequence: CooklangTranslationDraftStep[] = [];
  for (const t of stepTranslations) {
    if (t.actionId && t.targetInstanceId) {
      sequence.push({
        actionId: t.actionId,
        targetInstanceId: t.targetInstanceId,
        params: t.params,
        availableIngredientInstanceIds: t.availableIngredientInstanceIds,
        secondaryInstanceId: t.secondaryInstanceId,
      });
    }
  }

  const title = importDraft.metadata.title ?? slugToDisplayName(slug);

  return {
    draft: {
      id: slugToId(slug),
      names: { en: title },
      initialInventory: importDraft.proposedInventory,
      availableTools: [],
      sequence,
      metadata: {
        notes:
          "Draft translated from Cooklang text by src/cooklang-translate.ts's translateCooklangDocument — " +
          "NOT yet a valid or trustworthy RecipeScript. Every step's translation notes (verb-match confidence, " +
          "unresolved targets, ambiguous/missing parameters) are named explicitly in the translation report this " +
          "draft was produced alongside; review those before touching anything else, then run " +
          "`npm run validate-recipe -- <this file>` and follow AUTHORING.md's loop until it passes cleanly.",
      },
    },
    stepTranslations,
    unresolvedIngredientTokens: importDraft.unresolvedTokens,
  };
}
