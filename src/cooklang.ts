import type { Entity, Quantity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import type { RecipeScript, RecipeInstance } from "./recipe.ts";

/**
 * Cooklang import/export — `ROADMAP.md` Phase 5, `ocr-converter.ts` as
 * planned (`CLAUDE.md`'s module-layout table; not a file named
 * `ocr-converter.ts` itself, same "planned name diverged" pattern as
 * `heat-source.ts`/`place.ts`/etc.). Scoped exactly along the boundary
 * `AUTHORING.md` §2 already drew, before any code existed:
 *
 * 1. **Parsing Cooklang's own syntax is mechanical** — `@ingredient{qty%unit}`,
 *    `#cookware{}`, `~timer{qty%unit}`, `>> metadata: value`, `-- comments`,
 *    `[- block comments -]`. Real grammar, no judgment calls, built here as
 *    `parseCooklang`.
 * 2. **Turning step PROSE into this repo's typed `actionId`/parameter shape
 *    is NOT mechanical** — that's the free-text -> structured-intent
 *    translation `ENGINE_INVARIANTS.md` #10 scopes to an LLM or human
 *    proposing a DRAFT, never asserted as already-valid. This module does
 *    NOT attempt it: `CooklangStep.text` keeps the step's prose verbatim
 *    (tokens inline, exactly as authored) for that translator to consume
 *    later — it is not itself a `RecipeStep`.
 * 3. `importCooklangDraft` closes the one piece of "1" that's genuinely
 *    useful before "2" exists: matching every `@token` against a real
 *    entity's `Entity.cooklang.canonicalToken` and proposing
 *    `RecipeInstance[]` for `initialInventory` — a best-effort MATCH, not a
 *    validation claim (unresolved tokens are named, not silently dropped;
 *    a caller still owes the result a real `validate-recipe` pass before
 *    treating it as usable, same as any other hand-authored draft).
 * 4. `exportToCooklang` is the reverse and fully mechanical in the other
 *    direction: an OCR `RecipeScript` already carries everything Cooklang
 *    syntax needs (entity tokens, quantities, action names, durations) —
 *    no prose synthesis, so no LLM-in-the-loop problem. It deliberately
 *    does NOT invent natural-language sentences; each step line is the
 *    action's own `names.en` plus its Cooklang-tokenized references and a
 *    plain parameter list, not literary prose.
 *
 * **Explicitly NOT built here** (real, named gaps, matching this repo's
 * own "gaps are named, not hidden" convention): Cooklang scaling
 * multipliers. `ingredient.ts`'s own `QuantitySchema` doc comment already
 * states no recipe-scaling engine exists anywhere in this repo to scale
 * AGAINST — `spiceLock` is PRESERVED faithfully round-trip (the `=`
 * prefix survives import -> export -> import unchanged) but never
 * multiplied, because nothing here multiplies anything yet.
 */

// ---------------------------------------------------------------------------
// Parsing (Cooklang text -> structured document)
// ---------------------------------------------------------------------------

export interface CooklangQuantity {
  /** Raw amount text exactly as authored, e.g. "1/2", "200" — kept
   *  verbatim because not every Cooklang amount is a plain decimal. */
  raw: string;
  /** Parsed numeric value when `raw` is an integer, decimal, or simple
   *  "a/b" fraction; undefined for non-numeric amounts like "some". */
  amount?: number;
  unit?: string;
}

export interface CooklangIngredientRef {
  kind: "ingredient";
  /** The token after `@`, e.g. "sal" or "aceite de oliva" (multi-word
   *  names require the `{}` form, same rule real Cooklang uses — see
   *  `parseCooklang`'s doc comment for the exact, bounded grammar this
   *  module supports). */
  token: string;
  quantity?: CooklangQuantity;
  /** True for a `=`-prefixed amount, e.g. `@sal{=1%tsp}` —
   *  `CLAUDE_DEV_CTX.md`'s "spice lock": this amount does not scale
   *  linearly with the rest of the recipe. */
  spiceLock: boolean;
  raw: string;
}

export interface CooklangCookwareRef {
  kind: "cookware";
  token: string;
  raw: string;
}

export interface CooklangTimerRef {
  kind: "timer";
  /** Label, e.g. "rest" in `~rest{5%minutes}`; undefined for the bare
   *  `~{5%minutes}` form. */
  name?: string;
  quantity: CooklangQuantity;
  raw: string;
}

export interface CooklangStep {
  /** The step's prose with every `@`/`#`/`~` token still inline, exactly
   *  as authored — Cooklang doesn't separate "text" from "references" and
   *  neither does this. Not a `RecipeStep`; see this file's top doc
   *  comment, point 2. */
  text: string;
  ingredients: CooklangIngredientRef[];
  cookware: CooklangCookwareRef[];
  timers: CooklangTimerRef[];
  /** The most recent `= Section =` heading above this step, if any. */
  section?: string;
}

export interface CooklangDocument {
  /** `>> key: value` lines, keyed by trimmed `key`. */
  metadata: Record<string, string>;
  steps: CooklangStep[];
}

/**
 * Matches, in order per scan position:
 * 1. Braced form: marker + a run of words/spaces immediately followed by
 *    `{...}` — the run can only include `[A-Za-z0-9_'-]` and single
 *    spaces, so it can never cross into another token's own `@`/`#`/`~`/
 *    `{`/`}` characters. This is what makes multi-word names unambiguous
 *    without a hand-rolled lookahead scanner: the name run structurally
 *    cannot swallow a LATER, unrelated token's braces, because reaching
 *    that other token's marker character ends the run first. The one real
 *    limitation (documented, not hidden): a stray `{...}` later in the
 *    same line with only plain words/spaces/hyphens between it and
 *    an earlier bare `@token` WILL be misread as that token's own braces —
 *    the same authoring discipline real Cooklang requires (write `{}`
 *    immediately after the name, nothing else in between).
 * 2. Bare form (ingredient/cookware only, no timer): marker + one word,
 *    no braces, no quantity.
 */
const TOKEN_RE =
  /([@#~])([A-Za-z0-9_'-]*(?:[ \t]+[A-Za-z0-9_'-]+)*)\{([^{}]*)\}|([@#])([A-Za-z0-9_'-]+)/g;

function parseQuantity(content: string): CooklangQuantity | undefined {
  if (content.trim() === "") return undefined;
  const [amountPartRaw, unitPart] = content.split("%");
  const amountPart = amountPartRaw.trim();
  const stripped = amountPart.startsWith("=") ? amountPart.slice(1).trim() : amountPart;
  let amount: number | undefined;
  if (/^\d+\/\d+$/.test(stripped)) {
    const [num, den] = stripped.split("/").map(Number);
    amount = den !== 0 ? num / den : undefined;
  } else if (stripped !== "" && !Number.isNaN(Number(stripped))) {
    amount = Number(stripped);
  }
  return { raw: amountPart, amount, unit: unitPart?.trim() || undefined };
}

function scanLineTokens(line: string): {
  ingredients: CooklangIngredientRef[];
  cookware: CooklangCookwareRef[];
  timers: CooklangTimerRef[];
} {
  const ingredients: CooklangIngredientRef[] = [];
  const cookware: CooklangCookwareRef[] = [];
  const timers: CooklangTimerRef[] = [];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(line)) !== null) {
    const raw = m[0];
    if (m[1] !== undefined) {
      // Braced form.
      const marker = m[1];
      const name = m[2].trim();
      const content = m[3];
      if (marker === "@") {
        const qty = parseQuantity(content);
        ingredients.push({
          kind: "ingredient",
          token: name,
          quantity: qty,
          spiceLock: content.trim().startsWith("="),
          raw,
        });
      } else if (marker === "#") {
        cookware.push({ kind: "cookware", token: name, raw });
      } else {
        // "~" timer: braced form is the only meaningful one.
        const qty = parseQuantity(content);
        if (qty) {
          timers.push({ kind: "timer", name: name === "" ? undefined : name, quantity: qty, raw });
        }
      }
    } else {
      // Bare form: ingredient or cookware, single word, no quantity.
      const marker = m[4];
      const name = m[5];
      if (marker === "@") {
        ingredients.push({ kind: "ingredient", token: name, spiceLock: false, raw });
      } else {
        cookware.push({ kind: "cookware", token: name, raw });
      }
    }
  }
  return { ingredients, cookware, timers };
}

/**
 * Parses real Cooklang source text into a structured `CooklangDocument`.
 * Deliberately does not attempt to resolve tokens against entities or
 * produce a `RecipeScript` — see this file's top doc comment.
 *
 * Step boundary rule (a stated simplification, not part of the official
 * grammar): a step is one blank-line-separated paragraph of non-metadata,
 * non-comment, non-section-heading lines, joined with a single space —
 * closer to how Cooklang recipes are actually authored (a step can wrap
 * across lines) than "one line = one step" would be.
 */
export function parseCooklang(source: string): CooklangDocument {
  // Strip block comments first — they can span multiple lines.
  const withoutBlockComments = source.replace(/\[-[\s\S]*?-\]/g, "");
  const lines = withoutBlockComments.split(/\r?\n/);

  const metadata: Record<string, string> = {};
  const steps: CooklangStep[] = [];
  let currentSection: string | undefined;
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const text = buffer.join(" ").trim();
    buffer = [];
    if (text === "") return;
    const { ingredients, cookware, timers } = scanLineTokens(text);
    steps.push({ text, ingredients, cookware, timers, section: currentSection });
  };

  for (const rawLine of lines) {
    // Strip a trailing line comment (-- to end of line).
    const line = rawLine.replace(/--.*$/, "").trim();

    if (line === "") {
      flush();
      continue;
    }
    const metaMatch = /^>>\s*([^:]+):\s*(.*)$/.exec(line);
    if (metaMatch) {
      flush();
      metadata[metaMatch[1].trim()] = metaMatch[2].trim();
      continue;
    }
    const sectionMatch = /^=+\s*(.*?)\s*=*$/.exec(line);
    if (sectionMatch && line.startsWith("=")) {
      flush();
      currentSection = sectionMatch[1].trim() || undefined;
      continue;
    }
    buffer.push(line);
  }
  flush();

  return { metadata, steps };
}

// ---------------------------------------------------------------------------
// Import (parsed document -> a draft proposal against real entities)
// ---------------------------------------------------------------------------

/** g/kg/ml/l/tsp/tbsp/cup/count plus common written-out aliases actually
 *  seen in authored Cooklang text — mapped to `QuantitySchema`'s closed
 *  unit enum (`ingredient.ts`). Anything else is left unmapped rather than
 *  guessed at. */
const UNIT_ALIASES: Record<string, string> = {
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cup: "cup",
  cups: "cup",
  count: "count",
  unit: "count",
  units: "count",
};

function normalizeToken(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function toRecipeQuantity(q: CooklangQuantity | undefined): Quantity | undefined {
  if (!q || q.amount === undefined) return undefined;
  const unit = q.unit ? UNIT_ALIASES[q.unit.toLowerCase()] : undefined;
  if (!unit) return undefined;
  return {
    kind: "precise",
    amount: q.amount,
    unit: unit as "g" | "kg" | "ml" | "l" | "tsp" | "tbsp" | "cup" | "count",
  };
}

export interface ResolvedCooklangIngredient {
  ref: CooklangIngredientRef;
  entityId: string;
}

export interface CooklangImportDraft {
  metadata: Record<string, string>;
  /** One entry per DISTINCT token (case/whitespace-normalized) that
   *  matched a real entity's `cooklang.canonicalToken`, OR — failing
   *  that — an entity's bare `id` (case-insensitively). The `id` fallback
   *  mirrors `exportToCooklang`'s own fallback for entities with no
   *  `cooklang` field (`cooklangToken`): without it, exporting such an
   *  entity and re-importing the result would silently fail to round-trip,
   *  which would make the fallback a one-way lossy hole rather than a
   *  documented, symmetric approximation. */
  resolvedIngredients: ResolvedCooklangIngredient[];
  /** Distinct tokens that matched no entity — named explicitly rather
   *  than silently dropped, this file's own version of `REFERENCES.md`'s
   *  "don't hide the gap" discipline applied to import coverage. */
  unresolvedTokens: string[];
  /** A DRAFT `RecipeInstance[]` for `RecipeScriptSchema.initialInventory`,
   *  built only from resolved ingredients. `state` defaults to `"raw"` —
   *  Cooklang text never encodes an entity's physical state, so this is a
   *  guess a human/`validate-recipe` must confirm, not a fact this module
   *  derived. Never asserted valid on its own — see this file's top doc
   *  comment, point 3. */
  proposedInventory: RecipeInstance[];
  steps: CooklangStep[];
}

/**
 * Parses `source` and matches every ingredient token against `entities`'
 * `cooklang.canonicalToken` (case/whitespace-normalized). Produces a DRAFT
 * only — see this file's top doc comment.
 */
export function importCooklangDraft(
  source: string,
  entities: Map<string, Entity>
): CooklangImportDraft {
  const doc = parseCooklang(source);

  const tokenToEntity = new Map<string, Entity>();
  const idToEntity = new Map<string, Entity>();
  for (const entity of entities.values()) {
    if (entity.cooklang) tokenToEntity.set(normalizeToken(entity.cooklang.canonicalToken), entity);
    idToEntity.set(normalizeToken(entity.id), entity);
  }

  const resolvedIngredients: ResolvedCooklangIngredient[] = [];
  const unresolvedTokens: string[] = [];
  const seenTokens = new Set<string>();
  const proposedInventory: RecipeInstance[] = [];
  let counter = 0;

  for (const step of doc.steps) {
    for (const ref of step.ingredients) {
      const normalized = normalizeToken(ref.token);
      if (seenTokens.has(normalized)) continue;
      seenTokens.add(normalized);

      const entity = tokenToEntity.get(normalized) ?? idToEntity.get(normalized);
      if (!entity) {
        unresolvedTokens.push(ref.token);
        continue;
      }
      resolvedIngredients.push({ ref, entityId: entity.id });
      counter += 1;
      proposedInventory.push({
        id: `${normalized.replace(/\s+/g, "_")}-${counter}`,
        entityId: entity.id,
        state: "raw",
        tags: [],
        quantity: toRecipeQuantity(ref.quantity),
      });
    }
  }

  return {
    metadata: doc.metadata,
    resolvedIngredients,
    unresolvedTokens,
    proposedInventory,
    steps: doc.steps,
  };
}

// ---------------------------------------------------------------------------
// Export (RecipeScript -> Cooklang text)
// ---------------------------------------------------------------------------

function cooklangToken(entity: Entity): string {
  return entity.cooklang?.canonicalToken ?? entity.id;
}

function formatQuantity(q: Quantity | undefined, spiceLock: boolean): string {
  if (!q || q.kind !== "precise") return "";
  const amount = spiceLock ? `=${q.amount}` : `${q.amount}`;
  return `{${amount}%${q.unit}}`;
}

/**
 * Exports an OCR `RecipeScript` to Cooklang text. Fully mechanical — no
 * prose synthesis (see this file's top doc comment, point 4): each step
 * line is the action's own `names.en`, its Cooklang-tokenized instance
 * references, and a plain `key: value` parameter list, not literary prose.
 *
 * `spawnedEntityIds` (optional) should be `RecipeRunResult.spawnedEntityIds`
 * (`recipe-runner.ts`) when the caller has one, so a step targeting an
 * instance SPAWNED mid-recipe (e.g. a `SEPARATE` output) still resolves to
 * a real `@token` instead of a raw instance id — the same
 * compose-with-real-ground-truth precedent `execution-bounds.ts`/
 * `in-progress-action.ts` already established, not a second, static
 * re-derivation of the spawn-naming scheme. Omit it and spawned-instance
 * references fall back to their bare instance id, named as a limitation
 * rather than guessed at.
 */
export function exportToCooklang(
  recipe: RecipeScript,
  entities: Map<string, Entity>,
  actions: Map<string, Action>,
  spawnedEntityIds: Map<string, string> = new Map()
): string {
  const instanceEntityId = new Map<string, string>();
  for (const item of recipe.initialInventory) instanceEntityId.set(item.id, item.entityId);
  for (const [instanceId, entityId] of spawnedEntityIds) instanceEntityId.set(instanceId, entityId);

  const initialQuantity = new Map<string, Quantity | undefined>();
  for (const item of recipe.initialInventory) initialQuantity.set(item.id, item.quantity);

  const lines: string[] = [];
  lines.push(`>> title: ${recipe.names.en}`);
  lines.push("");

  const mentioned = new Set<string>();

  const refFor = (instanceId: string): string => {
    const entityId = instanceEntityId.get(instanceId);
    const entity = entityId ? entities.get(entityId) : undefined;
    if (!entity) return instanceId; // Unknown — named, not guessed at.
    const token = cooklangToken(entity);
    if (mentioned.has(instanceId)) return `@${token}`;
    mentioned.add(instanceId);
    const qty = initialQuantity.get(instanceId);
    const spiceLock = entity.cooklang?.spiceLock ?? false;
    const suffix = formatQuantity(qty, spiceLock);
    return `@${token}${suffix}`;
  };

  for (const step of recipe.sequence) {
    const action = actions.get(step.actionId);
    const verb = action?.names.en ?? step.actionId;
    const parts: string[] = [`${verb} ${refFor(step.targetInstanceId)}`];

    if (step.secondaryInstanceId) parts.push(`with ${refFor(step.secondaryInstanceId)}`);
    for (const id of step.availableIngredientInstanceIds) parts.push(`using ${refFor(id)}`);

    const durationSeconds = step.params.durationSeconds;
    if (durationSeconds) parts.push(`for ~{${durationSeconds}%seconds}`);

    const otherParams = Object.entries(step.params).filter(([k]) => k !== "durationSeconds");
    let line = parts.join(" ") + ".";
    if (otherParams.length > 0) {
      line += ` (${otherParams.map(([k, v]) => `${k}: ${v}`).join(", ")})`;
    }
    lines.push(line);
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
