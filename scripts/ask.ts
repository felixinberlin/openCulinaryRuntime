import { join } from "node:path";
import { loadActions, loadRecipes, loadCcps } from "../src/registry.ts";
import { answerAboutParameter, answerAboutDomainFact } from "../src/query.ts";

/**
 * A real query interface, not a demo of one — usage:
 *   npx tsx scripts/ask.ts <actionId> <parameterId>
 * e.g. npx tsx scripts/ask.ts emulsify oilAdditionRate
 *
 * Prints ONLY what's actually in data/*.json — allowedValues, whether the
 * parameter is state-determining or informational, every metadata note that
 * mentions it, and every real recipe that has used it. No generated prose.
 *
 * A second mode, added 2026-08-17 alongside `DomainFactSchema`
 * (`ROADMAP.md`'s "Structured DomainFact/PhysicalProperty records" gap):
 *   npx tsx scripts/ask.ts fact <ccpId> <factId>
 * e.g. npx tsx scripts/ask.ts fact egg_cooking eggYolkCoagulationTemp
 */

const root = join(import.meta.dirname, "..");

if (process.argv[2] === "fact") {
  const [, ccpId, factId] = process.argv.slice(2);
  if (!ccpId || !factId) {
    console.error("Usage: npx tsx scripts/ask.ts fact <ccpId> <factId>");
    process.exit(1);
  }
  const ccps = loadCcps(join(root, "data", "ccps"));
  const answer = answerAboutDomainFact(ccps, ccpId, factId);
  if (!answer) {
    console.error(`No CCP "${ccpId}" with domainFacts entry "${factId}" found.`);
    process.exit(1);
  }
  const { fact } = answer;
  const value =
    typeof fact.value === "number" ? String(fact.value) : `${fact.value.min}-${fact.value.max}`;
  console.log(`${answer.ccpNameEn} (${answer.ccpId}).domainFacts.${answer.factId}`);
  console.log(`  value: ${value} ${fact.unit}`);
  console.log(`  verified: ${fact.verified}`);
  console.log(`  citation: ${fact.citation.source} (${fact.citation.confidence})`);
  if (fact.citation.note) console.log(`  citation note: ${fact.citation.note}`);
  if (fact.note) console.log(`  note: ${fact.note}`);
  process.exit(0);
}

const [actionId, parameterId] = process.argv.slice(2);
if (!actionId || !parameterId) {
  console.error(
    "Usage: npx tsx scripts/ask.ts <actionId> <parameterId>\n" +
      "   or: npx tsx scripts/ask.ts fact <ccpId> <factId>"
  );
  process.exit(1);
}

const actions = loadActions(join(root, "data", "actions"));
const recipes = loadRecipes(join(root, "data", "recipes"));

const answer = answerAboutParameter(actions, recipes, actionId, parameterId);
if (!answer) {
  console.error(`No action "${actionId}" with parameter "${parameterId}" found.`);
  process.exit(1);
}

console.log(`${answer.actionVerb}.${answer.parameterId}`);
if (answer.allowedValues) console.log(`  allowedValues: ${answer.allowedValues.join(" | ")}`);
if (answer.numericRange)
  console.log(
    `  numericRange: ${answer.numericRange.min}-${answer.numericRange.max} ${answer.numericRange.unit}`
  );
console.log(`  required: ${answer.required}`);
console.log(
  `  stateDetermining: ${answer.stateDetermining} ${answer.stateDetermining ? "" : "(informational only — recorded, not enforced)"}`
);

if (answer.relevantNotes.length > 0) {
  console.log(`\n  Domain knowledge (metadata.*, cited in-file):`);
  for (const note of answer.relevantNotes) {
    console.log(`  [${note.key}]\n    ${note.text}\n`);
  }
}

if (answer.recipeUsages.length > 0) {
  console.log(`  Real recipe usage:`);
  for (const usage of answer.recipeUsages) {
    console.log(
      `  - ${usage.recipeNameEn} (${usage.recipeId}), step ${usage.stepIndex}: ${answer.parameterId} = ${usage.value ?? "(not set)"}`
    );
  }
} else {
  console.log(`  No recipe in data/recipes/ currently sets this parameter.`);
}
