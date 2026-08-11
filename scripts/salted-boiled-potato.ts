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
