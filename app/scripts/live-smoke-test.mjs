import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before running this test.");
}

function client() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function rpc(instance, name, args) {
  const response = await instance.rpc(name, args);
  if (response.error) throw response.error;
  return response.data;
}

const [a, b, c] = [client(), client(), client()];
for (const instance of [a, b, c]) {
  const response = await instance.auth.signInAnonymously();
  if (response.error) throw response.error;
}

const created = await rpc(a, "create_room", { p_display_name: "Smoke A" });
const roomId = created.room.id;
const code = created.room.code;
await rpc(b, "join_room", { p_code: code.toLowerCase(), p_display_name: "Smoke B" });
await rpc(c, "join_room", { p_code: `  ${code}  `, p_display_name: "Smoke C" });

let state = await rpc(a, "get_room_state", { p_room_id: roomId });
if (state.players.length !== 3 || !state.permissions.startGame) throw new Error("Three-player lobby failed.");

for (const action of ["start_game", "advance_briefing", "start_huddle", "open_decision"]) {
  state = await rpc(a, "room_action", { p_room_id: roomId, p_action: action });
}

await rpc(a, "submit_choice", { p_room_id: roomId, p_price: 3 });
await rpc(b, "submit_choice", { p_room_id: roomId, p_price: 4 });
await rpc(c, "submit_choice", { p_room_id: roomId, p_price: 4 });

const beforeReveal = await rpc(a, "get_room_state", { p_room_id: roomId });
if (beforeReveal.result !== null) throw new Error("Result leaked before reveal.");
if (beforeReveal.players.some((player) => "choice" in player || "price" in player)) {
  throw new Error("Another player's price leaked before reveal.");
}

const revealed = await rpc(a, "room_action", { p_room_id: roomId, p_action: "reveal" });
if (
  revealed.result.totalProfit !== 65 ||
  revealed.result.profits.A !== 55 ||
  revealed.result.profits.B !== 5 ||
  revealed.result.profits.C !== 5
) {
  throw new Error("The live economics result was incorrect.");
}

const replay = await rpc(a, "room_action", { p_room_id: roomId, p_action: "play_again" });
if (replay.room.phase !== "briefing" || replay.room.roundNumber !== 2) {
  throw new Error("Replay did not advance to round two.");
}

console.log(`Live Supabase smoke test passed in room ${code}.`);

