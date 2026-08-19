// Public surface for direct-import consumers (e.g. the cooking-simulator
// sibling project) — see SIMULATOR_API.md. Re-exports everything already
// marked `export` in each file below; adding a new export to any src/*.ts
// file surfaces here automatically, zero maintenance. Not a curated
// subset — SIMULATOR_API.md is where "what's v1-relevant vs. deferred"
// guidance lives, as documentation, not an import filter.

// Schemas / core types
export * from "./ingredient.ts";
export * from "./action.ts";
export * from "./thermal.ts";
export * from "./heat-source.ts";
export * from "./place.ts";
export * from "./recipe.ts";

// Engine
export * from "./engine.ts";

// Data loading
export * from "./registry.ts";
export * from "./knowledge-base.ts";

// Recipe execution / authoring / interop-adjacent
export * from "./recipe-runner.ts";
export * from "./recipe-player.ts";
export * from "./recipe-narrator.ts";
export * from "./recipe-explain.ts";
export * from "./recipe-scaffold.ts";

// Reachability / planning / sandbox
export * from "./reachability.ts";
export * from "./planner.ts";
export * from "./applicable-actions.ts";

// Query / progress
export * from "./query.ts";
export * from "./in-progress-action.ts";
export * from "./execution-bounds.ts";

// Domain-physics helpers
export * from "./altitude.ts";
export * from "./cut-dimensions.ts";
export * from "./egg-doneness.ts";
export * from "./egg-heat-penetration.ts";
export * from "./heat-penetration.ts";
export * from "./potato-doneness.ts";
export * from "./flavor-balance.ts";
export * from "./tool-hygiene.ts";

// Concurrent-step scheduling / execution IR — likely NOT needed for v1 of
// a single-user simulator loop, re-exported for completeness only. See
// SIMULATOR_API.md.
export * from "./dag-scheduler.ts";
export * from "./execution-graph.ts";
export * from "./execution-graph-compiler.ts";

// Authoring/export/interop — secondary/deferred for v1. See SIMULATOR_API.md.
export * from "./cooklang.ts";
export * from "./cooklang-translate.ts";
export * from "./schema-org.ts";
export * from "./nutrition-extension.ts";
export * from "./foodon-crosswalk.ts";
