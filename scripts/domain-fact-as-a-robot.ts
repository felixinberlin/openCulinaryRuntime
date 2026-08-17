import { join } from "node:path";
import { loadCcps } from "../src/registry.ts";
import { CriticalControlPointSchema } from "../src/thermal.ts";
import { answerAboutDomainFact } from "../src/query.ts";

/**
 * First end-to-end proof for `ingredient.ts`'s `DomainFactSchema` +
 * `CriticalControlPointSchema.domainFacts`, added 2026-08-17 — closes
 * ROADMAP.md's "Structured DomainFact/PhysicalProperty records" gap.
 * `egg_cooking.json`'s own migration (from an ad-hoc, UNVALIDATED
 * `metadata.coagulationReferenceC` object to two real, typed
 * `domainFacts` entries) is the concrete forcing case this gap was
 * named against — this script proves the two real, checkable claims
 * that migration was supposed to deliver: (1) a robot/verifier can read
 * a real numeric fact WITHOUT parsing any prose, and (2) a malformed
 * fact — the exact class of authoring mistake the old ad-hoc metadata
 * blob had zero protection against — is now actually caught by Zod.
 */

const root = join(import.meta.dirname, "..");
const ccps = loadCcps(join(root, "data", "ccps"));

console.log("1. Typed, structured access — no prose parsing, no LLM needed (ENGINE_INVARIANTS.md #10):\n");
const eggCooking = ccps.get("egg_cooking")!;
for (const factId of Object.keys(eggCooking.domainFacts)) {
  const answer = answerAboutDomainFact(ccps, "egg_cooking", factId)!;
  const { fact } = answer;
  const value = typeof fact.value === "number" ? fact.value : `${fact.value.min}-${fact.value.max}`;
  console.log(`  ${factId}: ${value} ${fact.unit} (verified: ${fact.verified}, source: ${fact.citation.source})`);
}

console.log(
  "\n2. A real computation using the structured value directly, no string parsing involved — e.g. a robot " +
    "checking whether a measured temperature falls within the egg-yolk coagulation range:\n"
);
const yolkFact = eggCooking.domainFacts.eggYolkCoagulationTemp;
const yolkRange = yolkFact.value as { min: number; max: number };
for (const measuredC of [60, 67, 72]) {
  const inRange = measuredC >= yolkRange.min && measuredC <= yolkRange.max;
  console.log(`  measured ${measuredC}°C: ${inRange ? "within" : "outside"} the yolk coagulation range`);
}

console.log(
  "\n3. A malformed domainFacts entry (missing 'unit') is rejected by Zod — the exact validation gap the " +
    "old ad-hoc metadata.coagulationReferenceC object (z.record(z.string(), z.unknown())) never had:\n"
);
const malformedCcp = {
  id: "test_ccp",
  names: { en: "test" },
  instantaneousC: 74,
  heldC: 57,
  heldSeconds: 60,
  pathogen: "Salmonella spp.",
  source: "test fixture",
  domainFacts: {
    brokenFact: {
      value: 100,
      // unit deliberately omitted
      citation: { source: "test", confidence: "standard_reference" },
      verified: true,
    },
  },
};
const result = CriticalControlPointSchema.safeParse(malformedCcp);
console.log(`  Zod validation: ${result.success ? "UNEXPECTEDLY PASSED" : `REJECTED — ${result.error!.issues[0].message} at ${result.error!.issues[0].path.join(".")}`}`);

console.log(
  "\n4. 'verified' is a real, independent axis from citation.confidence — both eggYolkCoagulationTemp and " +
    "eggWhiteCoagulationTemp are commonly_cited_unverified (a named source exists) AND verified: false (nobody " +
    "in this session independently checked the specific numbers against McGee's actual text):\n"
);
for (const factId of Object.keys(eggCooking.domainFacts)) {
  const fact = eggCooking.domainFacts[factId];
  console.log(`  ${factId}: citation.confidence = "${fact.citation.confidence}", verified = ${fact.verified}`);
}

console.log(
  "\nStill NOT closed by this change, named rather than implied covered: engine.ts's applyAction never reads " +
    "domainFacts at all (by design — these are reference facts, not enforced thresholds; instantaneousC/heldC/" +
    "heldSeconds/thermalModel remain the only fields actually consulted for enforcement); only egg_cooking.json " +
    "has been migrated — every other metadata.notes prose paragraph in this repo (the overwhelming majority) " +
    "stays prose, correctly, since most of it is genuinely reasoning/technique explanation, not a single " +
    "extractable number; EntitySchema/ActionSchema were deliberately NOT also given a domainFacts field — no " +
    "second real forcing case existed yet, and adding one speculatively would have repeated the exact " +
    "declared-but-dead-capability mistake this repo has caught and fixed multiple times before."
);
