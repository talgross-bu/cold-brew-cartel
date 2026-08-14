# Cold Brew Cartel application specification

## Purpose

Cold Brew Cartel is a three-minute classroom pricing game illustrating cartel instability, dominant strategy, and the prisoner's dilemma. Three students in a Zoom breakout room run three competing cold-brew carts. Each independently selects a price of $3 or $4, and the application combines their choices and reveals the resulting quantities and profits.

This version replaces private Zoom-chat price submissions. Spoken negotiation remains in Zoom.

## Product boundaries

- Exactly three players per room.
- Exactly one spokesperson, who is also Cart A and a full player.
- One private, irreversible price submission per player per round.
- The same room can replay with the same assignments and no cumulative score.
- No instructor dashboard, spectator role, built-in text or voice chat, permanent account, email collection, class-wide lobby, or matchmaking.

## Entry flow

The public landing screen preserves the current hero artwork and description and presents two primary paths:

1. **I'm the spokesperson**
   - Explain: "Create the room, share its word, and lead your group through the game."
   - Ask for a first name or nickname, 1–24 visible characters.
   - On submit, create the room and assign the spokesperson to Cart A.

2. **Join my group**
   - Explain: "Enter the word your spokesperson gives you."
   - Ask for the room word and a first name or nickname.
   - Normalize the word by trimming surrounding whitespace and converting it to lowercase.
   - A shared URL may prefill the word with `?room=maple`, but it must not automatically join.

Do not call either path "sign up" or "log in." Students are using short-lived guest sessions.

## Word codes

- Use only the exact 200 values in `room-code-words.json`.
- Words are 4–8 lowercase ASCII letters. Display them in uppercase for legibility, but accept any capitalization.
- An active room exclusively reserves its word until its 24-hour expiry.
- The spokesperson lobby shows the word in a large code card: **Tell your group to join with MAPLE**.
- Provide **Copy joining link** and **Copy word** buttons, with an accessible confirmation and a manual-copy fallback.
- Do not silently correct spelling or map near-matches. A nonexistent word gets: "We couldn't find that room. Check the word with your spokesperson."
- When all 200 codes are reserved, room creation returns: "All game rooms are currently in use. Please try again shortly."

## Player assignment and lobby

- Spokesperson: Cart A, coral, and room leader.
- First participant to join: Cart B, green.
- Second participant to join: Cart C, blue.
- Assignment is authoritative on the server and cannot be selected or changed by the browser.
- Duplicate nicknames are allowed because the cart letter is the durable identity.
- The lobby displays all three cart cards with nickname or **Waiting for player**.
- The spokesperson sees **Start the game**, disabled until all three seats are filled.
- Other players see **Waiting for your spokesperson to start**.
- Participants may leave during the lobby, freeing their B or C seat. Once the game starts, seats are locked.
- A fourth player receives: "This group already has three players. Ask your spokesperson to create a new room if needed."

## Synchronized room state machine

The server is authoritative for every phase. Clients render the latest `RoomState`; they do not advance themselves.

### 1. Lobby

- Wait for Carts A, B, and C.
- Only the spokesperson can transition to `briefing`.

### 2. Briefing

- Preserve the existing "Pick a cart. Maximize its profit" screen, rules, price options, and profit formula.
- The spokesperson sees **Got it—start the huddle**.
- Other players see **Waiting for your spokesperson**.
- The spokesperson advances everyone to `huddle`.

### 3. Huddle

- Preserve the existing 20-second timer and cartel copy.
- Initially show **Start 20-second huddle** and **Skip huddle** to the spokesperson.
- Starting the timer stores one server timestamp. All devices calculate their display from that timestamp so refreshes remain synchronized.
- When time reaches zero, enable **Make the decision** for the spokesperson. The spokesperson may also end the huddle early after it has started.
- **Skip huddle** transitions directly to `decision`.

### 4. Decision

- Replace the Zoom-chat instructions with: "Choose privately. Your choice locks when you submit, and no one—not even your spokesperson—can see it before the reveal."
- Each player sees their assigned cart and two large choices: **Charge $3** and **Charge $4**.
- Require an explicit **Lock in $3** or **Lock in $4** confirmation. Submission is irreversible for that round.
- After submitting, show the player's own price and a three-cart readiness list containing only **Ready** or **Choosing…**.
- Do not run the old 3–2–1 Zoom countdown.
- The spokesperson's **Reveal the market** button is disabled until all three submissions exist.
- Non-spokespeople see **Waiting for your spokesperson to reveal the market** after everyone is ready.

### 5. Result

- Reveal all three prices to all devices in the same server transition.
- Preserve the current animated market, quantities, revenue, cost, profit cards, outcome copy, dominance table, total-profit comparison, final lesson, concept tags, and discussion question.
- The spokesperson sees **Play again**. Other players see **Waiting for your spokesperson to start another round**.
- Replay increments the round, retains the room, word, spokesperson, nicknames, and cart assignments, clears current submission state, and returns everyone to `briefing`.
- Historical rounds are not shown and do not contribute to a cumulative score.

## Realtime, refresh, and failure behavior

- Save the guest token locally only after successful create/join. On refresh, use it to recover the same player, cart, spokesperson status, and room state.
- Realtime events trigger a fresh sanitized state request. If realtime disconnects, show a small **Reconnecting…** status and poll every two seconds until the channel recovers.
- Never roll back to an earlier phase because of an out-of-order response; compare the server `version` field.
- Disable action buttons while requests are pending and make repeated clicks harmless.
- If the spokesperson refreshes, leadership persists. There is no automatic leadership transfer.
- If the spokesperson permanently leaves after the game starts, the group must create a new room.
- At expiry, show: "This room has expired. Ask your spokesperson to create a new game."
- On an unexpected server error, retain the current UI and choice selection, announce the error, and offer **Try again**.

## Visual and accessibility requirements

- Closely preserve `source/index.html`: cream paper surfaces, coffee/caramel/mint/coral/blue palette, Georgia display type, system sans-serif body type, cart and cup illustrations, rounded panels, shadows, and restrained playful motion.
- Reuse CSS-native artwork; do not introduce external stock images.
- Maintain comfortable phone layouts at 390px and scale through tablet and desktop.
- All actions must work by keyboard. Use visible focus, correct button disabled states, semantic headings, labeled inputs, and polite/assertive live regions where appropriate.
- Move focus to the main heading after synchronized phase changes without stealing focus while a user is typing.
- Honor `prefers-reduced-motion` and do not make progress dependent on animation.
- Never communicate cart, readiness, or profit using color alone.

