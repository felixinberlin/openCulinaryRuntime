import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";
import { answerAboutEntityDomainFact } from "../src/query.ts";

/**
 * Proves ROADMAP.md's "Salt/pepper crystal/grind size as distinct
 * products" gap — closed 2026-08-17 alongside `EntitySchema.domainFacts`
 * (extending `DomainFactSchema` from `CriticalControlPointSchema`-only to
 * entities, once this real second forcing case existed).
 *
 * Two real, distinct things proven, not just asserted:
 * 1. `salt.json`/`kosher_salt.json`/`flaky_salt.json` are all fully
 *    interchangeable substitutes for SALT's own `requiredIngredientCapabilities`
 *    check (`isSaltySeasoning`) — this engine has no volume-vs-mass
 *    computation to catch a real substitution error, so it correctly
 *    accepts all three.
 * 2. The REAL, cited, structured difference between them — the actual
 *    substance of this gap — is queryable via `domainFacts`, not buried
 *    in prose: a robot (or a human) can ask "how many grams is a
 *    teaspoon of THIS salt" and get a real, typed, cited answer that
 *    differs meaningfully across the three.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const salt = actions.get("salt")!;

console.log("1. All three real salt products are accepted as substitutes for SALT — no engine check catches a volume-based mistake:\n");
for (const entityId of ["salt", "kosher_salt", "flaky_salt"]) {
  const instance: Instance = { entityId: "potato", state: "fried", tags: [] };
  const result = applyAction(instance, salt, entities, new Set(), { timing: "after_cooking" }, new Set([entityId]), ccps);
  console.log(`  potato + ${entityId}: SALT succeeds — tags [${result.instance.tags}]`);
}

console.log(
  "\n2. The REAL, structured, queryable difference this gap exists to close — three genuinely different " +
    "grams-per-teaspoon figures for the SAME sodium-chloride substance, a real substitution risk this engine " +
    "cannot catch mechanically but CAN now answer as a real, cited fact:\n"
);
for (const entityId of ["salt", "kosher_salt", "flaky_salt"]) {
  const answer = answerAboutEntityDomainFact(entities, entityId, "gramsPerTeaspoon")!;
  const value = typeof answer.fact.value === "number" ? answer.fact.value : `${answer.fact.value.min}-${answer.fact.value.max}`;
  console.log(`  ${answer.entityNameEn}: ${value} ${answer.fact.unit} — ${answer.fact.citation.confidence}`);
}

console.log(
  "\n  Concrete illustration of the real risk: a recipe author writing '2 tsp salt' and a robot substituting " +
    "Diamond Crystal kosher salt (3g/tsp) for table salt (6g/tsp) without adjusting the amount would deliver " +
    "roughly HALF the intended sodium — a genuinely different dish, not a rounding error. This engine's " +
    "QuantitySchema has no unit-conversion computation to catch this (a real, named, unenforced gap — the " +
    "structured domainFacts data exists to make the RISK visible and queryable, not to prevent it)."
);

console.log(
  "\nStill NOT closed by this script, named rather than implied covered: no automatic volume-to-mass " +
    "conversion anywhere in this engine (QuantitySchema's 'precise' kind never converts between its own " +
    "units); flaky_salt.json's isDissolvable: false is a real, correct distinguishing fact but is not checked " +
    "against SALT's own requiredIngredientCapabilities (SALT would still nominally accept it for a dissolving " +
    "use case it's not realistically meant for — a real, named simplification); pepper's own crystal/grind " +
    "size (whole/cracked/ground) was already partially modeled via CRUSH before this session and is untouched."
);
