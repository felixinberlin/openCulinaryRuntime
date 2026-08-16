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
  console.log(
    `  CRACK: "${instance.state}" -> egg destroyed, spawned egg_cracked ("${cracked.state}")`
  );
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

function beat(
  instance: Instance,
  intensity: "lightly_beaten" | "beaten" | "well_beaten"
): Instance {
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

console.log(
  "\n5. Plain / French omelette — crack, then optionally beat (more or less) in a bowl, then fry:"
);
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

console.log(
  "\n6. Scrambled eggs (crack, then scramble — BEAT applies here too, same as the omelette, omitted for brevity):"
);
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
