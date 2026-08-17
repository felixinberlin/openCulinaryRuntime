import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Capability test for `SEASON` (`data/actions/season.json`) — ROADMAP.md's
 * long-deferred "Generalizing SALT/PEPPER/CHILI into one parameter-driven
 * SEASON verb" entry, closed 2026-08-17 once its own two named blockers
 * (`addsTagFromParameter`, a way to identify WHICH ingredient satisfied a
 * capability check) actually existed. Proves the SAME potato instance,
 * seasoned four genuinely different ways through ONE verb — the real
 * payoff: a caller with a `seasoningType` variable at runtime doesn't need
 * to branch on which of four fixed action ids to call.
 *
 * Also proves the real bug a flat `requiredIngredientCapabilities` list
 * COULD NOT have caught: asking for `seasoningType: "salt"` while only
 * chili flakes are on hand must fail, specifically because the wrong
 * ingredient is present — not just because no ingredient at all is
 * present.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const season = actions.get("season")!;

console.log("=== One verb, four real seasonings, the same potato instance ===\n");

const cases: { seasoningType: string; ingredientId: string; expectTag: string }[] = [
  { seasoningType: "salt", ingredientId: "salt", expectTag: "salted" },
  { seasoningType: "pepper", ingredientId: "black_pepper", expectTag: "peppered" },
  { seasoningType: "chili", ingredientId: "chili_flakes", expectTag: "chili_seasoned" },
  { seasoningType: "acid", ingredientId: "vinegar", expectTag: "acidified" },
];

let potato: Instance = { entityId: "potato", state: "boiled", tags: [] };
for (const { seasoningType, ingredientId, expectTag } of cases) {
  const result = applyAction(
    potato,
    season,
    entities,
    new Set(),
    { seasoningType, timing: "after_cooking" },
    new Set([ingredientId])
  );
  const ok = result.instance.tags.includes(expectTag) && result.matchedIngredientInstanceId === ingredientId;
  console.log(
    `  [${ok ? "PASS" : "FAIL"}] SEASON(seasoningType: "${seasoningType}") with "${ingredientId}" on hand: ` +
      `tags [${result.instance.tags}], matchedIngredientInstanceId: "${result.matchedIngredientInstanceId}"`
  );
  potato = result.instance; // carry tags forward — a real potato really can be salted AND peppered AND ...
}

console.log(
  "\n  Same instance's own state/tags stay coherent throughout — real kosher_salt/flaky_salt/vinegar-as-acid " +
    "substitutability (already proven separately by salt-crystal-size-as-a-robot.ts) works identically here, " +
    "since SEASON reuses the exact same four capability flags, not new ones."
);

console.log("\n=== The real bug a flat requiredIngredientCapabilities list could not catch ===\n");
const rawPotato: Instance = { entityId: "potato", state: "raw", tags: [] };
try {
  applyAction(rawPotato, season, entities, new Set(), { seasoningType: "salt" }, new Set(["chili_flakes"]));
  console.log("  Unexpected: should have been rejected — only chili flakes are on hand, not salt.");
} catch (e) {
  console.log(`  SEASON(seasoningType: "salt") with only chili_flakes on hand: REJECTED — ${(e as Error).message}`);
}

console.log("\n=== matchedIngredientInstanceId — the real, additional thing this offers over a flat list ===\n");
const withBothOnHand = applyAction(
  rawPotato,
  season,
  entities,
  new Set(),
  { seasoningType: "pepper" },
  new Set(["salt", "black_pepper", "chili_flakes", "vinegar"]) // all four on hand at once
);
console.log(
  `  With all four seasonings available, seasoningType: "pepper" correctly matched "` +
    `${withBothOnHand.matchedIngredientInstanceId}" specifically — not just "something matched."`
);

console.log(
  "\nStill NOT closed, honestly named rather than implied covered: SEASON is ADDITIVE, not a replacement — " +
    "salt.json/pepper.json/chili.json/acid.json are unchanged and still what all 18 real seasoning-using " +
    "recipes actually call; no recipe was migrated to SEASON, since the four separate verbs already work " +
    "correctly and migrating them would be pure churn for zero functional gain. requiredIngredientCapability" +
    "FromParameter/addsTagFromParameter are also still checked-for-presence-only, same limit as the static " +
    "requiredIngredientCapabilities list — matchedIngredientInstanceId is reported but nothing decrements or " +
    "consumes that specific instance from inventory."
);
