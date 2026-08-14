import type { RealtimeChannel } from "@supabase/supabase-js";
import { ensureAnonymousSession, supabase } from "./supabase";
import type { ActionName, Price, RoomState } from "./types";

type RpcPayload = Record<string, unknown>;

const LAST_ROOM_KEY = "cold-brew-cartel:last-room-id";

export class RoomServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RoomServiceError";
  }
}

function client() {
  if (!supabase) throw new RoomServiceError("NOT_CONFIGURED", "Supabase is not configured.");
  return supabase;
}

function parseRpcError(error: { message: string; code?: string | null }): RoomServiceError {
  const knownCodes = [
    "ROOM_CAPACITY_REACHED",
    "ROOM_NOT_FOUND",
    "ROOM_FULL",
    "ROOM_ALREADY_STARTED",
    "ROOM_EXPIRED",
    "UNAUTHORIZED",
    "FORBIDDEN",
    "INVALID_PHASE",
    "PLAYERS_REQUIRED",
    "CHOICES_REQUIRED",
    "CHOICE_LOCKED",
    "INVALID_NAME",
    "INVALID_PRICE",
  ];
  const code = knownCodes.find((candidate) => error.message.includes(candidate)) ?? error.code ?? "UNKNOWN";
  const messages: Record<string, string> = {
    ROOM_CAPACITY_REACHED: "All game rooms are currently in use. Please try again shortly.",
    ROOM_NOT_FOUND: "We couldn't find that room. Check the word with your spokesperson.",
    ROOM_FULL: "This group already has three players. Ask your spokesperson to create a new room if needed.",
    ROOM_ALREADY_STARTED: "That game has already started. Ask your spokesperson to create a new room.",
    ROOM_EXPIRED: "This room has expired. Ask your spokesperson to create a new game.",
    UNAUTHORIZED: "This browser no longer has access to that room.",
    FORBIDDEN: "Only the spokesperson can do that.",
    INVALID_PHASE: "That action is not available during this part of the game.",
    PLAYERS_REQUIRED: "All three carts must be filled before the game starts.",
    CHOICES_REQUIRED: "All three players must lock in a price before the reveal.",
    CHOICE_LOCKED: "Your price is already locked for this round.",
    INVALID_NAME: "Enter a nickname between 1 and 24 characters.",
    INVALID_PRICE: "Choose either $3 or $4.",
  };
  return new RoomServiceError(code, messages[code] ?? "Something went wrong. Please try again.");
}

async function rpc<T>(name: string, payload: RpcPayload): Promise<T> {
  await ensureAnonymousSession();
  const response = await client().rpc(name, payload);
  if (response.error) throw parseRpcError(response.error);
  return response.data as T;
}

function rememberRoom(roomId: string): void {
  localStorage.setItem(LAST_ROOM_KEY, roomId);
}

export function forgetRoom(): void {
  localStorage.removeItem(LAST_ROOM_KEY);
}

export function lastRoomId(): string | null {
  return localStorage.getItem(LAST_ROOM_KEY);
}

export async function createRoom(displayName: string): Promise<RoomState> {
  const state = await rpc<RoomState>("create_room", { p_display_name: displayName });
  rememberRoom(state.room.id);
  return state;
}

export async function joinRoom(code: string, displayName: string): Promise<RoomState> {
  const state = await rpc<RoomState>("join_room", { p_code: code, p_display_name: displayName });
  rememberRoom(state.room.id);
  return state;
}

export async function getRoomState(roomId: string): Promise<RoomState> {
  return rpc<RoomState>("get_room_state", { p_room_id: roomId });
}

export async function performRoomAction(roomId: string, action: ActionName): Promise<RoomState | null> {
  const state = await rpc<RoomState | null>("room_action", { p_room_id: roomId, p_action: action });
  if (action === "leave_lobby") forgetRoom();
  return state;
}

export async function submitChoice(roomId: string, price: Price): Promise<RoomState> {
  return rpc<RoomState>("submit_choice", { p_room_id: roomId, p_price: price });
}

export function subscribeToRoom(
  syncKey: string,
  onVersion: (version: number) => void,
  onStatus: (connected: boolean) => void,
): RealtimeChannel {
  return client()
    .channel(`room:${syncKey}`)
    .on("broadcast", { event: "state" }, ({ payload }) => {
      const version = Number(payload?.version);
      if (Number.isFinite(version)) onVersion(version);
    })
    .subscribe((status) => onStatus(status === "SUBSCRIBED"));
}

export async function unsubscribeFromRoom(channel: RealtimeChannel): Promise<void> {
  await client().removeChannel(channel);
}

