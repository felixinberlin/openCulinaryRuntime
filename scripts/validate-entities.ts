import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EntitySchema } from "../src/ingredient.ts";

const dir = join(import.meta.dirname, "..", "data", "entities");
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

let failed = 0;
for (const file of files) {
  const raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
  const result = EntitySchema.safeParse(raw);
  if (result.success) {
    console.log(`OK   ${file}  (id: ${result.data.id})`);
  } else {
    failed++;
    console.error(`FAIL ${file}`);
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed}/${files.length} entit${failed === 1 ? "y" : "ies"} failed validation.`);
  process.exit(1);
}
console.log(`\nAll ${files.length} entities valid.`);
