# Backend and security specification

## Architectural boundary

Use Lovable Cloud as the persistence, server-function, and realtime layer. The browser must not query or mutate tables directly. Enable row-level security on every table and grant no direct browser role access. Server functions validate the guest bearer token and perform privileged operations.

The guest token is the player's credential. The easy room word is a locator, not an authentication secret.

## Tables

### `room_code_pool`

| Column | Type | Rules |
|---|---|---|
| `word` | text primary key | Lowercase; `^[a-z]{4,8}$`; seeded from `room-code-words.json` |
| `active_room_id` | uuid nullable unique | Current reservation |
| `reserved_until` | timestamptz nullable | Same as the room expiry |

The table must contain exactly 200 rows after migration.

### `rooms`

| Column | Type | Rules |
|---|---|---|
| `id` | uuid primary key | Generated server-side |
| `code_word` | text not null | References `room_code_pool.word`; always normalized lowercase |
| `sync_key` | text not null unique | Random 128-bit-or-stronger base64url value; never logged |
| `spokesperson_player_id` | uuid nullable | Set to the Cart A player during creation |
| `phase` | text not null | One of `lobby`, `briefing`, `huddle`, `decision`, `result` |
| `round_number` | integer not null | Starts at 1 and remains positive |
| `huddle_ends_at` | timestamptz nullable | Authoritative shared timer end |
| `version` | bigint not null | Starts at 1; increments once per successful mutation |
| `created_at` | timestamptz not null | Server time |
| `expires_at` | timestamptz not null | `created_at + 24 hours` |

### `players`

| Column | Type | Rules |
|---|---|---|
| `id` | uuid primary key | Generated server-side |
| `room_id` | uuid not null | Cascading reference to `rooms` |
| `cart` | text not null | One of `A`, `B`, `C`; unique within the room |
| `display_name` | text not null | Trimmed, 1–24 visible characters, no control characters |
| `token_hash` | text not null unique | SHA-256 hash of the guest token; raw token is never stored |
| `joined_at` | timestamptz not null | Server time |
| `last_seen_at` | timestamptz not null | Updated by authenticated state requests |

### `choices`

| Column | Type | Rules |
|---|---|---|
| `id` | uuid primary key | Generated server-side |
| `room_id` | uuid not null | Cascading reference to `rooms` |
| `round_number` | integer not null | Must equal the room's current round at submission |
| `player_id` | uuid not null | Cascading reference to `players` |
| `price` | smallint not null | Exactly 3 or 4 |
| `submitted_at` | timestamptz not null | Server time |

Enforce unique `(room_id, round_number, player_id)`. There is no update or delete operation for a submitted choice.

### `round_results`

| Column | Type | Rules |
|---|---|---|
| `id` | uuid primary key | Generated server-side |
| `room_id` | uuid not null | Cascading reference to `rooms` |
| `round_number` | integer not null | Unique with `room_id` |
| `prices` | jsonb not null | Keys A/B/C; values 3 or 4 |
| `quantities` | jsonb not null | Server-calculated from `game-rules.json` |
| `profits` | jsonb not null | Server-calculated integers |
| `total_profit` | integer not null | Sum of the three profits |
| `revealed_at` | timestamptz not null | Server time |

## Guest credentials

- Generate tokens with at least 256 bits from a cryptographically secure random source and encode them as base64url.
- Return the raw token only from successful create/join. Store only its SHA-256 hash.
- Send it on later calls as `Authorization: Bearer <token>`.
- Store it in local storage under a room-ID-scoped key. Never include it in URLs, analytics, logs, or realtime payloads.
- Reject missing, malformed, expired, or unknown tokens with a generic unauthorized response.

## Server API

All payloads and responses are JSON. Error responses use a stable code and safe user message and contain no database details.

### `create-room`

Request: `{ "displayName": string }`

In one transaction:

1. Validate the name.
2. Release any code-pool reservations whose rooms have expired.
3. Select one available word in randomized order with row locking/skip-locked semantics.
4. If none exists, return `ROOM_CAPACITY_REACHED`.
5. Create the room, Cart A player, spokesperson link, and word reservation.
6. Commit before returning `{ "playerToken", "syncKey", "state" }`.

### `join-room`

Request: `{ "code": string, "displayName": string }`

- Normalize `code` with `trim().toLowerCase()`.
- Lock the matching nonexpired lobby room.
- Assign B if open, otherwise C. If neither is open, return `ROOM_FULL`.
- Never allow joining after `lobby`.
- Return `{ "playerToken", "syncKey", "state" }` only after commit.

### `get-room-state`

Credential: guest bearer token.

Return the following typed shape:

```ts
type RoomState = {
  room: {
    id: string;
    code: string;
    phase: "lobby" | "briefing" | "huddle" | "decision" | "result";
    roundNumber: number;
    huddleEndsAt: string | null;
    version: number;
    expiresAt: string;
  };
  self: {
    playerId: string;
    cart: "A" | "B" | "C";
    displayName: string;
    isSpokesperson: boolean;
    submitted: boolean;
    choice: 3 | 4 | null;
  };
  players: Array<{
    cart: "A" | "B" | "C";
    displayName: string;
    submitted: boolean;
  }>;
  permissions: {
    startGame: boolean;
    advanceBriefing: boolean;
    startHuddle: boolean;
    openDecision: boolean;
    reveal: boolean;
    playAgain: boolean;
    leaveLobby: boolean;
  };
  result: null | {
    prices: Record<"A" | "B" | "C", 3 | 4>;
    quantities: Record<"A" | "B" | "C", number>;
    profits: Record<"A" | "B" | "C", number>;
    totalProfit: number;
    revealedAt: string;
  };
};
```

Sanitization rules:

- Before `result`, `self.choice` may contain only the caller's submitted choice.
- Before `result`, no response may contain any other player's price.
- `players[].submitted` exposes readiness only.
- `result` is non-null only in the `result` phase.
- Do not serialize internal columns such as token hashes or sync keys into `state`.

### `room-action`

Request: `{ "action": string }`

Supported actions and valid transitions:

- `start_game`: spokesperson only; `lobby → briefing`; requires A/B/C.
- `advance_briefing`: spokesperson only; `briefing → huddle`.
- `start_huddle`: spokesperson only; remains in `huddle`; sets `huddle_ends_at = now + 20 seconds` once.
- `open_decision`: spokesperson only; `huddle → decision`; allowed after the timer started, at zero, or as the explicit skip action before it starts.
- `reveal`: spokesperson only; `decision → result`; requires exactly three current-round choices. In the same transaction, calculate and insert the unique result.
- `play_again`: spokesperson only; `result → briefing`; increment the round and clear timer state. Preserve prior immutable rows until room expiry.
- `leave_lobby`: non-spokesperson only; lobby phase only; delete the caller's player row and free the cart.

Lock the room row for each transition, verify the current phase and round, and make repeated identical requests idempotent.

### `submit-choice`

Request: `{ "price": 3 | 4 }`

- Require a valid room member, nonexpired room, `decision` phase, and current round.
- Insert once using the unique constraint. Never update an existing choice.
- A retry with the same price returns the existing success response; a retry with a different price returns `CHOICE_LOCKED`.
- Return the newly sanitized `RoomState`.

## Result calculation

Implement the calculation independently on the server and client from the rules in `game-rules.json`. The server output is authoritative. Never accept quantities, profits, totals, cart identity, round number, or phase from the browser.

## Realtime synchronization

- Give room members the random `syncKey` after authenticated create/join.
- Subscribe to a channel named from that unguessable value, not from the word code.
- After every committed mutation, publish only `{ "version": number }`.
- Do not publish names, readiness, prices, quantities, profits, bearer tokens, room words, or result content.
- On an event with a newer version, each client calls `get-room-state`.
- When the channel is unavailable, poll `get-room-state` every two seconds. Stop polling when realtime recovers or the component unmounts.

A participant capable of sending a forged invalidation can cause only a harmless state refetch; they cannot alter authoritative state.

## Expiry and cleanup

- All state and mutation calls reject a room once `expires_at <= now()`.
- On room creation, transactionally clear stale `room_code_pool` reservations before allocation.
- Run scheduled cleanup when supported: delete expired rooms (cascading players, choices, and results) and clear their code-pool reservations.
- Lazy release during `create-room` is mandatory even when scheduled cleanup exists.

## Security invariants

- No service-role or privileged key is bundled into browser code.
- All tables have RLS enabled with no permissive browser policies.
- Prices are never logged or sent to error monitoring before reveal.
- Nicknames are stored as text and rendered as text, never injected as HTML.
- Database constraints—not UI checks—enforce three seats, cart uniqueness, valid prices, one choice, and one result.
- Generic join failures do not expose player tokens or internal room IDs.
- Abuse controls must tolerate many students behind one school IP; do not use a low per-IP limit that blocks a 200-room class.

