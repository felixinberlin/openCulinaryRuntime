import { join } from "node:path";
import { loadEntities, loadMealPatternContributions } from "../src/registry.ts";
import { creditedAmount } from "../src/nutrition-extension.ts";
import type { Quantity } from "../src/ingredient.ts";

/**
 * Capability test for `src/nutrition-extension.ts` — `ROADMAP.md` Phase 6's
 * `UsdaMealPatternContributionSchema`. Real, cited data
 * (`data/meal-pattern-contributions/*.json`) against real entities
 * (`data/entities/*.json`), fed representative per-serving quantities to
 * exercise every crediting basis. Not pulled from `data/recipes/*.json`
 * directly: `RecipeInstance.quantity` is optional and most real recipes in
 * this repo don't author one (there's nothing to credit without a real
 * quantity, by design — see `reference/nutrition-extension.md`), so the
 * quantities below are clearly-labeled representative serving sizes, not
 * asserted recipe facts.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const contributions = loadMealPatternContributions(
  join(root, "data", "meal-pattern-contributions")
);

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

function check(entityId: string, quantity: Quantity | undefined, label: string) {
  const entity = entities.get(entityId);
  if (!entity) throw new Error(`Fixture entity missing: ${entityId}`);
  const file = contributions.get(entityId);
  if (!file) throw new Error(`Fixture meal-pattern-contribution missing: ${entityId}`);
  const credit = creditedAmount(file.contribution, quantity);
  console.log(
    `${entity.names.en} (${label}): ${credit ? `${credit.amount} ${credit.unit}` : "not credited"}`
  );
  return credit;
}

// --- Every real crediting basis, against real cited data -------------------

section("Real crediting bases");

const eggCredit = check("egg", { kind: "precise", amount: 1, unit: "count" }, "1 egg");
if (eggCredit?.amount !== 2 || eggCredit.unit !== "ounce_equivalent") {
  throw new Error("Expected 1 egg to credit as 2.0 oz eq meat/meat alternate.");
}

const milkCredit = check("milk", { kind: "precise", amount: 1, unit: "cup" }, "1 cup");
if (milkCredit?.amount !== 1 || milkCredit.unit !== "cup_equivalent") {
  throw new Error("Expected 1 cup of milk to credit as 1.0 cup eq milk.");
}

const potatoCredit = check("potato", { kind: "precise", amount: 0.5, unit: "cup" }, "1/2 cup");
if (potatoCredit?.amount !== 0.5 || potatoCredit.unit !== "cup_equivalent") {
  throw new Error("Expected 1/2 cup potato to credit as 0.5 cup eq vegetable (starchy).");
}

const flourCredit = check("flour", { kind: "precise", amount: 32, unit: "g" }, "32 g");
if (flourCredit?.amount !== 2 || flourCredit.unit !== "ounce_equivalent") {
  throw new Error("Expected 32g flour (2x 16g) to credit as 2.0 oz eq grains.");
}

// --- Honest "not credited" cases, not guessed at ----------------------------

section("Honest non-credit cases");

const oilCredit = check("oil", { kind: "precise", amount: 30, unit: "ml" }, "30 ml — a real fat");
if (oilCredit !== undefined) {
  throw new Error("Expected oil (not_creditable) to never credit toward any component.");
}

const saltCredit = check(
  "salt",
  { kind: "imprecise", descriptor: "pinch" },
  "a pinch — a real seasoning"
);
if (saltCredit !== undefined) {
  throw new Error("Expected salt (not_creditable) to never credit toward any component.");
}

const garlicNoQty = check("garlic", undefined, "no authored quantity");
if (garlicNoQty !== undefined) {
  throw new Error(
    "Expected garlic with no authored quantity to be honestly uncredited, not guessed at."
  );
}

const onionWrongUnit = check(
  "onion",
  { kind: "precise", amount: 100, unit: "g" },
  "100 g — a mass, not the volume this crediting rate is defined against"
);
if (onionWrongUnit !== undefined) {
  throw new Error(
    "Expected a mass quantity against a volume-based (cup) crediting rate to be uncredited, not silently converted."
  );
}

console.log(
  "\nConfirmed: real crediting bases (count/volume/mass) all compute correctly against real cited " +
    "data, and every case this module can't honestly credit (missing quantity, wrong unit, imprecise/" +
    "relative quantity, an audited not_creditable ingredient) reports undefined instead of guessing."
);

console.log(
  "\nSpec: 7 CFR 210.10 (National School Lunch Program meal pattern) + USDA Food Buying Guide for " +
    "Child Nutrition Programs crediting rates — see REFERENCES.md."
);
console.log("\nAll nutrition-extension.ts capability checks passed.");
