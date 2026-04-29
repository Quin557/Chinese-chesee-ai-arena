# Architecture Review

## Current Issues

- Game orchestration is concentrated in `src/App.tsx`. UI state, snapshot history, worker orchestration, victory checks, and player input handling are all coupled in one component.
- Rule generation is mostly correct and separated into `rules.ts`, `check.ts`, and `moveGenerator.ts`, but it previously had no automated regression coverage.
- AI search, move ordering, opening strategy, and evaluation heuristics are still tightly coupled. `ai.ts` is responsible for too much engine policy.
- Win probability is derived from engine evaluation plus strategic heuristics, but the data model only exposes a coarse `EvalBreakdown`. This limits explainability.
- Board mutation is protected by cloning, which is safe for React, but deep cloning inside search is expensive and will become a ceiling for stronger AI.
- Repetition, long-check, and long-chase rules are not modeled yet. This is important for practical Xiangqi strength and for avoiding meaningless chase loops.

## Refactor Plan

1. Protect rule correctness with tests before changing more engine internals.
2. Extract game flow from `App.tsx` into a reducer or controller module so UI rendering and game state transitions can be tested separately.
3. Split AI into `search`, `ordering`, `evaluation`, `strategy`, and `timeControl` modules.
4. Add repetition-state tracking to game snapshots and AI search state.
5. Move from full-board cloning in deep search toward make/unmake move or compact board representations.
6. Expand evaluation explainability so win probability can cite material, king safety, initiative, stable threats, mobility, and repetition pressure separately.

## Priority

Rule correctness comes first. AI strength should be improved only after the rule engine and game-state transitions are guarded by tests.
