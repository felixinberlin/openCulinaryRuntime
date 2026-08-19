import type { Entity, Quantity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import type { RecipeScript } from "./recipe.ts";

/**
 * OCR -> Schema.org export (Roadmap Phase 5, `ocr-converter.ts` as
 * planned). One-directional and lossy by design — no import direction,
 * no round-trip. See `reference/schema-org.md` for design rationale,
 * scope, and citations.
 */

export interface SchemaOrgHowToStep {
  "@type": "HowToStep";
  text: string;
}

export interface SchemaOrgRecipe {
  "@context": "https://schema.org";
  "@type": "Recipe";
  name: string;
  recipeIngredient: string[];
  recipeInstructions: SchemaOrgHowToStep[];
  tool?: string[];
}

/** Culinary-plain-text prefixes for `Quantity`'s `imprecise` descriptors —
 *  see `reference/schema-org.md` for why `to_taste` is a suffix, not a prefix. */
const IMPRECISE_PREFIX: Record<string, string> = {
  pinch: "a pinch of",
  dash: "a dash of",
  handful: "a handful of",
  splash: "a splash of",
};

function entityName(entity: Entity | undefined, entityId: string, locale: string): string {
  if (!entity) return entityId; // Unknown — named, not guessed at.
  return entity.names[locale] ?? entity.names.en ?? entity.id;
}

function quantityPhrase(
  quantity: Quantity | undefined,
  name: string,
  entities: Map<string, Entity>,
  locale: string
): string {
  if (!quantity) return name;
  if (quantity.kind === "precise") {
    const unitLabel = quantity.unit === "count" ? "" : quantity.unit;
    return [String(quantity.amount), unitLabel, name].filter(Boolean).join(" ");
  }
  if (quantity.kind === "imprecise") {
    if (quantity.descriptor === "to_taste") return `${name}, to taste`;
    return `${IMPRECISE_PREFIX[quantity.descriptor]} ${name}`;
  }
  // "relative"
  const ofName = entityName(entities.get(quantity.ofEntityId), quantity.ofEntityId, locale);
  const percent = Math.round(quantity.ratio * 1000) / 10;
  return `${name} (${percent}% of ${ofName} by ${quantity.basis})`;
}

/**
 * Compiles one ingredient into a lossy Schema.org `recipeIngredient`
 * string — quantity + name, with the instance's current `state` appended
 * as a preparation note when it's not the generic starting `"raw"`. See
 * `reference/schema-org.md`.
 */
export function compileToSchemaOrgIngredient(
  entity: Entity,
  quantity: Quantity | undefined,
  state: string,
  entities: Map<string, Entity>,
  locale = "en"
): string {
  const name = entityName(entity, entity.id, locale);
  const line = quantityPhrase(quantity, name, entities, locale);
  return state && state !== "raw" ? `${line}, ${state}` : line;
}

function stepText(
  step: RecipeScript["sequence"][number],
  entities: Map<string, Entity>,
  actions: Map<string, Action>,
  instanceEntityId: Map<string, string>,
  locale: string
): string {
  const action = actions.get(step.actionId);
  const verb = action ? (action.names[locale] ?? action.names.en) : step.actionId;
  const nameFor = (instanceId: string): string =>
    entityName(entities.get(instanceEntityId.get(instanceId) ?? ""), instanceId, locale);

  const parts: string[] = [`${verb} the ${nameFor(step.targetInstanceId)}`];
  if (step.secondaryInstanceId) parts.push(`with the ${nameFor(step.secondaryInstanceId)}`);
  for (const id of step.availableIngredientInstanceIds) parts.push(`using the ${nameFor(id)}`);

  const durationSeconds = step.params.durationSeconds;
  if (durationSeconds) parts.push(`for ${durationSeconds} seconds`);

  let text = parts.join(" ") + ".";
  const otherParams = Object.entries(step.params).filter(([k]) => k !== "durationSeconds");
  if (otherParams.length > 0) {
    text += ` (${otherParams.map(([k, v]) => `${k}: ${v}`).join(", ")})`;
  }
  return text;
}

/**
 * Compiles a whole OCR `RecipeScript` into a Schema.org `Recipe` JSON-LD
 * object — `name`, `recipeIngredient`, `recipeInstructions`, and `tool`
 * (inherited from `Recipe`'s parent type `HowTo`) only. Deliberately does
 * NOT populate `recipeYield`/`prepTime`/`cookTime`/`nutrition` — nothing
 * in `RecipeScript` sources those honestly yet (see
 * `reference/schema-org.md`). Fully mechanical, no prose synthesis, same
 * one-directional/lossy contract as `exportToCooklang`.
 *
 * `spawnedEntityIds` (optional) should be `RecipeRunResult.spawnedEntityIds`
 * when available, so a step targeting a mid-recipe-spawned instance still
 * resolves to a real ingredient name instead of a raw instance id.
 */
export function compileToSchemaOrgRecipe(
  recipe: RecipeScript,
  entities: Map<string, Entity>,
  actions: Map<string, Action>,
  spawnedEntityIds: Map<string, string> = new Map(),
  locale = "en"
): SchemaOrgRecipe {
  const instanceEntityId = new Map<string, string>();
  for (const item of recipe.initialInventory) instanceEntityId.set(item.id, item.entityId);
  for (const [instanceId, entityId] of spawnedEntityIds) instanceEntityId.set(instanceId, entityId);

  const recipeIngredient = recipe.initialInventory.map((item) => {
    const entity = entities.get(item.entityId);
    return entity
      ? compileToSchemaOrgIngredient(entity, item.quantity, item.state, entities, locale)
      : item.entityId; // Unknown — named, not guessed at.
  });

  const recipeInstructions: SchemaOrgHowToStep[] = recipe.sequence.map((step) => ({
    "@type": "HowToStep",
    text: stepText(step, entities, actions, instanceEntityId, locale),
  }));

  const tool =
    recipe.availableTools.length > 0
      ? recipe.availableTools.map((id) => entityName(entities.get(id), id, locale))
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.names[locale] ?? recipe.names.en,
    recipeIngredient,
    recipeInstructions,
    ...(tool ? { tool } : {}),
  };
}
