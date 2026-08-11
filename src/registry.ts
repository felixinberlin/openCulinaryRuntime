import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EntitySchema, type Entity } from "./ingredient.ts";
import { ActionSchema, type Action } from "./action.ts";

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
