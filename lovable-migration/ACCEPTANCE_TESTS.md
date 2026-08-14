# Acceptance tests

## Automated gates

The Lovable project should provide repeatable commands for unit tests, integration tests, lint/type checks, and a production build. All must pass before publishing.

### Word-pool tests

- The JSON parses and contains exactly 200 strings.
- Every word is unique and matches `^[a-z]{4,8}$`.
- Join normalization trims and lowercases without fuzzy matching.
- Allocation never selects a reserved, unexpired word.
- Two simultaneous create transactions never receive the same word.
- Expired words can be reused.
- With 200 active rooms, the 201st create request returns `ROOM_CAPACITY_REACHED` and creates no rows.

### Economics tests

- Run the pure client calculation and independent server calculation against every `expectedOutcomes` fixture in `game-rules.json`.
- Assert prices, quantities, revenue, cost, per-cart profit, and total profit for all eight profiles.
- Assert the dominance table and outcome copy select the correct row by number of $3 prices.

### State and authorization tests

- Only Cart A/spokesperson may start, advance, reveal, or replay.
- Start is rejected until all three carts exist.
- Joining is rejected after lobby and for a fourth player.
- Simultaneous joins for the last seat yield one success and one `ROOM_FULL`.
- Submission is accepted only in `decision`, for the caller's current room/round, and only at 3 or 4.
- Retrying the same price is idempotent; changing a locked price returns `CHOICE_LOCKED`.
- Reveal is rejected until exactly three current-round choices exist.
- Concurrent reveals create one result and one phase transition.
- Replay increments the round once and retains players/carts.
- An invalid, expired, or cross-room token cannot read or mutate state.
- A nonspokesperson may leave only during lobby.

### Privacy tests

Before result, inspect every player's state response and assert:

- `self.choice` is either the caller's own price or null.
- No rival price occurs anywhere in the response.
- `result` is null.
- Realtime payloads contain only `version`.
- Raw table reads from browser roles are denied.
- Application logs and safe error payloads contain no token, token hash, sync key, or unrevealed price.

After reveal, all three authenticated room members receive the same result. A token from another room still cannot retrieve it.

## Three-browser classroom smoke test

Use three isolated sessions so local storage and guest tokens are independent.

1. In Browser A, press **I'm the spokesperson**, enter `Alex`, and create a room.
2. Confirm Cart A is assigned and a single word is displayed with copy controls.
3. In Browser B, use a mixed-case version of the word with surrounding spaces and join as `Blair`. Confirm Cart B.
4. In Browser C, follow the shared `?room=word` link, enter `Casey`, and confirm Cart C.
5. Attempt a fourth join in another private window and confirm the full-room message.
6. Confirm Browser A alone can start. Start and verify all three devices enter the briefing.
7. Advance to huddle, start the timer, and confirm all clocks remain within one second. Refresh Browser B and confirm the timer resumes from server time.
8. Open the decision. Submit $3 in A and $4 in B. Confirm C can see A/B as **Ready** but cannot see their prices. Confirm A cannot see B's price.
9. Submit $4 in C. Confirm reveal becomes available only in A.
10. Reveal and verify profile `344`: quantities `55/20/20`, profits `$55/$5/$5`, total `$65` on all devices.
11. In A, press **Play again**. Confirm all devices return to briefing with the same room, word, names, carts, and no current choices.
12. Refresh all browsers and confirm each recovers the correct role and phase.

## Visual and accessibility checks

- Check 390px, 768px, and desktop widths without horizontal scrolling or clipped controls.
- Complete the entire flow with keyboard only.
- Confirm every input has a persistent label and every button has an unambiguous accessible name.
- Confirm focus moves to the new phase heading but is never stolen from a text input.
- Confirm room changes, errors, copied-code feedback, readiness, timer completion, and reveal are announced appropriately.
- Enable reduced motion and verify the game remains complete and understandable.
- Verify cart identity, readiness, negative profit, and selected price are never communicated by color alone.
- Compare the briefing, huddle, and result screens side by side with `source/index.html` for visual and copy fidelity.

## Expiry and recovery checks

- Advance a test room's expiry and confirm every state/action call returns the expired-room experience.
- Confirm lazy cleanup releases its word even if scheduled cleanup has not run.
- Confirm reconnect polling starts on a dropped realtime connection, stops after recovery, and never regresses to an older `version`.
- Confirm request retries do not duplicate players, choices, results, or round increments.

