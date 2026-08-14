# Cold Brew Cartel project knowledge

## Product invariant

This is a short economics teaching game for exactly three students. One student is the spokesperson, creates the room, receives Cart A, shares the word code, and controls synchronized progress. The other students receive Carts B and C.

## Economics invariant

- Choices are exactly $3 and $4.
- Fixed cost is $55 and marginal cost is $1 per cup.
- Use `game-rules.json` as the test oracle for quantities and profits.
- Never adjust quantities, costs, payoff copy, dominance claims, or totals without explicit approval.

## Privacy invariant

- A submitted choice is irreversible for the round.
- Before the spokesperson reveals, a player may see only their own price and every cart's readiness.
- The spokesperson has no privileged access to prices before reveal.
- Do not place prices in realtime messages, logs, error payloads, analytics, or directly browser-readable tables.

## Room invariant

- Use only `room-code-words.json` for room words.
- Codes are case-insensitive and normalized to lowercase.
- A word can belong to only one unexpired room at a time.
- Maximum active capacity is 200 rooms.
- Guest sessions use server-validated opaque tokens and collect no email.
- Rooms expire after 24 hours.

## Experience invariant

- Preserve the visual language, teaching flow, copy, and CSS-native artwork in `source/index.html`.
- Spoken negotiation remains outside the site; do not add chat.
- Replay retains the room and carts but has no cumulative score.
- Do not add instructor, spectator, account, or matchmaking features.
- Use plain classroom language: spokesperson, group, cart, room word, choose, lock in, and reveal.

## Engineering standards

- Use TypeScript strict mode and typed service boundaries.
- Keep calculation and state-transition logic pure and unit tested.
- Treat the server as authoritative and make mutations transactional and idempotent.
- Do not call the database directly from UI components.
- Preserve keyboard access, visible focus, live announcements, semantic HTML, and reduced-motion behavior.
- Run unit, integration, security, and production-build checks before publishing.

