# Lovable prompt sequence

Use these prompts in order. Keep the uploaded files attached to the project conversation.

## Prompt 1 — inspect and plan

```text
Read every file in the uploaded Cold Brew Cartel migration kit before responding. Do not write code yet.

Treat source/index.html as the visual, copy, accessibility, animation, and economics reference. Treat APP_SPEC.md and BACKEND_SECURITY_SPEC.md as the required multiplayer contract. Treat game-rules.json and room-code-words.json as exact machine-readable fixtures, not suggestions. Treat PROJECT_KNOWLEDGE.md as permanent project guidance.

Produce an implementation plan for the current Lovable frontend stack plus Lovable Cloud. Explicitly trace the spokesperson flow, server-authoritative room state machine, private-choice boundary, word-code allocation, reconnect behavior, and tests. Flag any conflict you find between files. Do not simplify or redesign the game.
```

## Prompt 2 — build the visual frontend

```text
Implement the frontend described by the uploaded kit, using the current Lovable-supported stack and TypeScript strict mode.

Recreate source/index.html closely: retain its coffee-cart visual identity, typography feel, palette, five teaching stages, CSS-style illustrations, animations, exact economics copy, mobile behavior, focus handling, live announcements, and reduced-motion support. Add the landing role selection, spokesperson creation form, participant join form, three-seat lobby, readiness states, waiting states, reconnect state, and friendly errors from APP_SPEC.md.

Create a typed RoomService interface matching BACKEND_SECURITY_SPEC.md. For this step only, use a deterministic in-memory mock implementation so every screen and all eight outcomes can be previewed. Keep game calculation in a pure module driven by game-rules.json. Add unit tests for all eight outcomes and the room state reducer.

Do not enable a database yet. Do not replace the supplied economics, add authentication forms, add chat, add an instructor dashboard, add cumulative scores, or reveal rival choices early.
```

## Prompt 3 — add the multiplayer backend

```text
Enable Lovable Cloud and replace the mock RoomService with the production implementation in BACKEND_SECURITY_SPEC.md.

Create the private schema, exact constraints, indexes, 200-word code pool, server functions, transactional state transitions, 24-hour expiry behavior, guest-token hashing, sanitized RoomState responses, and realtime invalidation channel described in that file. All browser database access must be denied; only server functions may use privileged access. Realtime messages must never contain prices or result data.

Use the exact room-code-words.json values. Allocate and release words transactionally. Normalize join codes by trimming and lowercasing. Preserve the mock service behind a development-only test adapter, but ensure production always uses the Cloud service.

After implementing, run migrations, regenerate database types, run tests, and exercise create, join, submit, reveal, replay, expiry, and reconnect flows. Do not weaken row-level security to make the app work.
```

## Prompt 4 — harden security and concurrency

```text
Audit the finished app against BACKEND_SECURITY_SPEC.md and ACCEPTANCE_TESTS.md. Fix every discrepancy.

Test simultaneous room creation, simultaneous joins for the last seat, duplicate submissions, reveal races, replay races, invalid bearer tokens, cross-room tokens, guessed room words, malformed nicknames, expired rooms, and a full 200-room code pool. Verify raw choices are absent from pre-reveal HTTP responses, realtime messages, logs, errors, client caches, and directly queryable tables.

Run Lovable's database/RLS security checks and dependency checks. Do not resolve findings by granting public table access. Add or update automated tests for all fixes and report the exact test commands and results.
```

## Prompt 5 — final classroom QA

```text
Perform final visual, responsive, accessibility, and classroom-flow QA using source/index.html and ACCEPTANCE_TESTS.md.

Verify the complete experience at 390px, 768px, and desktop widths. Verify keyboard-only navigation, visible focus, live status announcements, reduced motion, disabled/loading states, copy-to-clipboard fallback, reconnect messaging, and clear distinction between spokesperson and participant controls. Keep the existing visual style and teaching copy intact.

Fix any regressions, run all tests and a production build, and give me a short three-browser release checklist. Do not publish until the checks pass.
```

