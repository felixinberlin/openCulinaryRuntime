import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { translateCooklangDocument } from "../src/cooklang-translate.ts";
import { makeEntity, makeAction } from "./helpers.ts";

const potato = makeEntity({
  id: "potato",
  cooklang: { canonicalToken: "patata", spiceLock: false },
});
const garlic = makeEntity({ id: "garlic", cooklang: { canonicalToken: "ajo", spiceLock: false } });
const oil = makeEntity({ id: "oil", cooklang: { canonicalToken: "aceite", spiceLock: false } });
const salt = makeEntity({ id: "salt", cooklang: { canonicalToken: "sal", spiceLock: true } });
const entities = new Map([
  ["potato", potato],
  ["garlic", garlic],
  ["oil", oil],
  ["salt", salt],
]);

const fry = makeAction({
  id: "fry",
  verb: "FRY",
  names: { en: "Fry", es: "Freír" },
  parameters: [
    { id: "heatLevel", required: false, allowedValues: ["low", "medium", "high"] },
    {
      id: "durationSeconds",
      required: false,
      numericRange: { unit: "seconds", min: 10, max: 1800 },
    },
    { id: "oilTempC", required: true, numericRange: { unit: "celsius", min: 120, max: 200 } },
  ],
});
const peel = makeAction({ id: "peel", verb: "PEEL", names: { en: "Peel" } });
const seasonAction = makeAction({
  id: "season",
  verb: "SEASON",
  names: { en: "Season" },
  parameters: [{ id: "seasoningType", required: true, allowedValues: ["salt", "pepper"] }],
});
const emulsify = makeAction({
  id: "emulsify",
  verb: "EMULSIFY",
  names: { en: "Emulsify" },
  requiredSecondaryCapability: "isEmulsifiable",
});
// Two distinct real actions genuinely can share one verb in this repo's
// own data (combine.json/combine_dough.json/... all share COMBINE) — this
// pair reproduces that collision synthetically so the ambiguity-handling
// path is unit-tested directly, not only proven against real data in
// scripts/cooklang-translate-as-a-robot.ts.
const combine = makeAction({ id: "combine", verb: "COMBINE", names: { en: "Combine" } });
const combineDough = makeAction({
  id: "combine_dough",
  verb: "COMBINE",
  names: { en: "Combine (dough)" },
});
const actions = new Map([
  ["fry", fry],
  ["peel", peel],
  ["season", seasonAction],
  ["emulsify", emulsify],
  ["combine", combine],
  ["combine_dough", combineDough],
]);

describe("translateCooklangDocument", () => {
  test("recognizes a verb, resolves the target instance, and leaves an empty notes array when nothing's missing", () => {
    const result = translateCooklangDocument("Peel @patata.", "test", entities, actions);
    assert.equal(result.stepTranslations.length, 1);
    const [step] = result.stepTranslations;
    assert.equal(step.actionId, "peel");
    assert.equal(step.targetInstanceId, "patata-1");
    assert.deepEqual(step.notes, []);
    assert.equal(result.draft.sequence.length, 1);
    assert.deepEqual(result.draft.sequence[0], {
      actionId: "peel",
      targetInstanceId: "patata-1",
      params: {},
      availableIngredientInstanceIds: [],
      secondaryInstanceId: undefined,
    });
  });

  test("matches a verb by any locale in Action.names, not just 'en'", () => {
    const result = translateCooklangDocument(
      "Freír @patata en #sarten{}.",
      "test",
      entities,
      actions
    );
    assert.equal(result.stepTranslations[0].actionId, "fry");
    assert.equal(result.stepTranslations[0].matchedVerb, "Freír");
  });

  test("infers durationSeconds from a Cooklang timer, converting units to seconds", () => {
    const result = translateCooklangDocument(
      "Fry @patata for ~{5%minutes}. (oilTempC: 175)",
      "test",
      entities,
      actions
    );
    // oilTempC is a numeric parameter in free-form parenthetical text, not
    // extractable from prose by this module — still flagged as missing,
    // exactly the documented limitation.
    assert.equal(result.stepTranslations[0].params.durationSeconds, "300");
  });

  test("infers an allowedValues parameter from a literal value appearing in the text", () => {
    const result = translateCooklangDocument(
      "Fry @patata at high heat.",
      "test",
      entities,
      actions
    );
    assert.equal(result.stepTranslations[0].params.heatLevel, "high");
  });

  test("an ambiguous allowedValues match (two values both present) is noted, not guessed", () => {
    const result = translateCooklangDocument(
      "Fry @patata somewhere between low and high heat.",
      "test",
      entities,
      actions
    );
    assert.equal(result.stepTranslations[0].params.heatLevel, undefined);
    assert.ok(result.stepTranslations[0].notes.some((n) => n.includes("ambiguous")));
  });

  test("a missing required allowedValues parameter is named, not silently skipped", () => {
    const result = translateCooklangDocument("Season @patata.", "test", entities, actions);
    assert.ok(
      result.stepTranslations[0].notes.some((n) => n.includes('required parameter "seasoningType"'))
    );
  });

  test("a missing required numeric parameter is named exactly once, even when durationSeconds (also numeric) was found", () => {
    const result = translateCooklangDocument(
      "Fry @patata for ~{90%seconds}.",
      "test",
      entities,
      actions
    );
    const notes = result.stepTranslations[0].notes;
    assert.equal(notes.filter((n) => n.includes("oilTempC")).length, 1);
    assert.equal(notes.filter((n) => n.includes("durationSeconds")).length, 0);
  });

  test("a step with two recognized verbs only produces one RecipeStep, naming the unused verb", () => {
    const result = translateCooklangDocument("Peel and season @patata.", "test", entities, actions);
    assert.equal(result.draft.sequence.length, 1);
    assert.equal(result.stepTranslations[0].actionId, "peel");
    assert.ok(
      result.stepTranslations[0].notes.some((n) =>
        n.includes('additional recognized verb "season"')
      )
    );
  });

  test("a requiredSecondaryCapability action guesses secondaryInstanceId from the second resolved ingredient, and says so", () => {
    const result = translateCooklangDocument(
      "Emulsify @patata using @aceite.",
      "test",
      entities,
      actions
    );
    const step = result.stepTranslations[0];
    assert.equal(step.actionId, "emulsify");
    assert.equal(step.targetInstanceId, "patata-1");
    assert.equal(step.secondaryInstanceId, "aceite-2");
    assert.ok(step.notes.some((n) => n.includes("requiredSecondaryCapability")));
  });

  test("no recognized verb produces no sequence entry, with a clear note, not a thrown error", () => {
    const result = translateCooklangDocument(
      "Whisper sweet nothings to @patata.",
      "test",
      entities,
      actions
    );
    assert.equal(result.draft.sequence.length, 0);
    assert.equal(result.stepTranslations[0].actionId, undefined);
    assert.deepEqual(result.stepTranslations[0].notes, [
      "no recognized action verb found in this step's text",
    ]);
  });

  test("a matched verb with no resolvable ingredient reference produces no sequence entry either", () => {
    const result = translateCooklangDocument("Peel it.", "test", entities, actions);
    assert.equal(result.draft.sequence.length, 0);
    assert.equal(result.stepTranslations[0].actionId, "peel");
    assert.ok(
      result.stepTranslations[0].notes.some((n) => n.includes("no target instance resolved"))
    );
  });

  test("the draft's title comes from Cooklang '>> title' metadata when present, else the slug", () => {
    const withTitle = translateCooklangDocument(
      ">> title: My Dish\n\nPeel @patata.",
      "my-slug",
      entities,
      actions
    );
    assert.equal(withTitle.draft.names.en, "My Dish");
    const withoutTitle = translateCooklangDocument("Peel @patata.", "my-slug", entities, actions);
    assert.equal(withoutTitle.draft.names.en, "My Slug");
  });

  test("a verb shared by two distinct actions is reported as ambiguous, never silently resolved to either one", () => {
    const result = translateCooklangDocument(
      "Combine @patata and @aceite.",
      "test",
      entities,
      actions
    );
    const step = result.stepTranslations[0];
    assert.equal(step.actionId, undefined);
    assert.equal(result.draft.sequence.length, 0);
    assert.equal(step.notes.length, 1);
    assert.match(step.notes[0], /^ambiguous action verb/);
    assert.match(step.notes[0], /combine/);
    assert.match(step.notes[0], /combine_dough/);
  });

  test("a more specific name disambiguates a shared verb when it's literally present in the text", () => {
    const result = translateCooklangDocument(
      "Combine (dough) @patata and @aceite.",
      "test",
      entities,
      actions
    );
    assert.equal(result.stepTranslations[0].actionId, "combine_dough");
  });

  test("unresolved ingredient tokens are carried through from importCooklangDraft", () => {
    const result = translateCooklangDocument(
      "Peel @some_unknown_thing.",
      "test",
      entities,
      actions
    );
    assert.deepEqual(result.unresolvedIngredientTokens, ["some_unknown_thing"]);
  });
});
