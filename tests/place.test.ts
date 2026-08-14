import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { emptyPlace, pourInto, advanceHeatSeconds, isAtBoiling } from "../src/place.ts";
import { makeEntity, makeHeatSource } from "./helpers.ts";

const water = makeEntity({
  id: "water",
  aggregationState: "liquid",
  thermophysical: { specificHeatJPerKgK: 4186, boilingPointC: 100 },
});

describe("pourInto", () => {
  test("fills an empty place", () => {
    const place = pourInto(emptyPlace("pot"), "water", 1, 20);
    assert.equal(place.contentsEntityId, "water");
    assert.equal(place.massKg, 1);
    assert.equal(place.currentTempC, 20);
  });

  test("rejects pouring into an already-occupied place", () => {
    const place = pourInto(emptyPlace("pot"), "water", 1, 20);
    assert.throws(() => pourInto(place, "water", 1, 20), /already contains/);
  });

  test("rejects a non-positive mass", () => {
    assert.throws(() => pourInto(emptyPlace("pot"), "water", 0, 20), /positive/);
    assert.throws(() => pourInto(emptyPlace("pot"), "water", -1, 20), /positive/);
  });
});

describe("advanceHeatSeconds", () => {
  test("matches the same Q=mcΔT / P physics estimatedPreheatSeconds uses, for a clean case", () => {
    // 1kg water, 20C -> heat for exactly the textbook time to reach 100C at 1000W/100%.
    const waterMassKg = 1;
    const startTempC = 20;
    const targetTempC = 100; // water.thermophysical.boilingPointC, matching the fixture above
    const waterSpecificHeatJPerKgK = 4186; // matching the fixture's thermophysical.specificHeatJPerKgK
    const deliveredWattsAt100PercentEfficiency = 1000; // makeHeatSource({id:"ideal"})'s default
    const source = makeHeatSource({ id: "ideal" });
    const place = pourInto(emptyPlace("pot"), "water", waterMassKg, startTempC);
    const secondsToBoil =
      (waterMassKg * waterSpecificHeatJPerKgK * (targetTempC - startTempC)) / deliveredWattsAt100PercentEfficiency;
    const boiled = advanceHeatSeconds(place, source, secondsToBoil, water);
    assert.ok(Math.abs(boiled.currentTempC - 100) < 1e-9);
  });

  test("clamps at boilingPointC instead of overshooting — the latent-heat-of-vaporization plateau", () => {
    const source = makeHeatSource({ id: "ideal" });
    const place = pourInto(emptyPlace("pot"), "water", 1, 20);
    // Deliberately way more energy than needed to reach 100C.
    const boiled = advanceHeatSeconds(place, source, 100000, water);
    assert.equal(boiled.currentTempC, 100);
  });

  test("temperature rises monotonically across successive ticks — real intermediate progress, not one-shot", () => {
    const source = makeHeatSource({ id: "ideal" });
    let place = pourInto(emptyPlace("pot"), "water", 1, 20);
    let previous = place.currentTempC;
    for (let i = 0; i < 5; i++) {
      place = advanceHeatSeconds(place, source, 30, water);
      assert.ok(place.currentTempC > previous, "temperature should strictly increase each tick while below boiling");
      previous = place.currentTempC;
    }
  });

  test("throws on an empty place — nothing poured in yet", () => {
    const source = makeHeatSource({ id: "ideal" });
    assert.throws(() => advanceHeatSeconds(emptyPlace("pot"), source, 60, water), /nothing has been poured/);
  });

  test("throws when contentsEntity doesn't match what's actually in the place", () => {
    const source = makeHeatSource({ id: "ideal" });
    const oil = makeEntity({ id: "oil", aggregationState: "liquid" });
    const place = pourInto(emptyPlace("pot"), "water", 1, 20);
    assert.throws(() => advanceHeatSeconds(place, source, 60, oil), /mismatched entity/);
  });

  test("throws for an entity with no boilingPointC to clamp against", () => {
    const source = makeHeatSource({ id: "ideal" });
    const undefinedThermal = makeEntity({ id: "mystery" });
    const place = pourInto(emptyPlace("pot"), "mystery", 1, 20);
    assert.throws(() => advanceHeatSeconds(place, source, 60, undefinedThermal), /no thermophysical/);
  });

  test("is a no-op once already at or above boiling", () => {
    const source = makeHeatSource({ id: "ideal" });
    const place = pourInto(emptyPlace("pot"), "water", 1, 100);
    const result = advanceHeatSeconds(place, source, 60, water);
    assert.equal(result.currentTempC, 100);
  });
});

describe("isAtBoiling", () => {
  test("false below the boiling point, true at or above it", () => {
    const below = pourInto(emptyPlace("pot"), "water", 1, 99);
    const at = pourInto(emptyPlace("pot"), "water", 1, 100);
    assert.equal(isAtBoiling(below, water), false);
    assert.equal(isAtBoiling(at, water), true);
  });
});
