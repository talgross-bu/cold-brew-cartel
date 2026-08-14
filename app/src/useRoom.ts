import { useCallback, useEffect, useRef, useState } from "react";
import {
  createRoom,
  forgetRoom,
  getRoomState,
  joinRoom,
  lastRoomId,
  performRoomAction,
  RoomServiceError,
  submitChoice,
  subscribeToRoom,
  unsubscribeFromRoom,
} from "./roomService";
import { configurationError, ensureAnonymousSession } from "./supabase";
import type { ActionName, Price, RoomState } from "./types";

export function useRoom() {
  const [state, setState] = useState<RoomState | null>(null);
  const [booting, setBooting] = useState(true);
  const [pending, setPending] = useState(false);
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState<string | null>(configurationError);
  const stateRef = useRef<RoomState | null>(null);

  const acceptState = useCallback((next: RoomState | null) => {
    if (!next) return;
    const current = stateRef.current;
    if (current && current.room.id === next.room.id && current.room.version > next.room.version) return;
    stateRef.current = next;
    setState(next);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    const room = stateRef.current;
    if (!room) return;
    try {
      acceptState(await getRoomState(room.room.id));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to refresh the room.";
      setError(message);
      if (cause instanceof RoomServiceError && ["ROOM_EXPIRED", "UNAUTHORIZED"].includes(cause.code)) {
        forgetRoom();
      }
    }
  }, [acceptState]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ensureAnonymousSession();
        const roomId = lastRoomId();
        if (roomId) {
          const restored = await getRoomState(roomId);
          if (!cancelled) acceptState(restored);
        }
      } catch (cause) {
        if (cause instanceof RoomServiceError && ["ROOM_EXPIRED", "UNAUTHORIZED"].includes(cause.code)) {
          forgetRoom();
        } else if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Unable to connect to the game service.");
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [acceptState]);

  useEffect(() => {
    if (!state?.room.syncKey) return;
    let pollId: number | null = null;
    const channel = subscribeToRoom(
      state.room.syncKey,
      (version) => {
        if (version > (stateRef.current?.room.version ?? 0)) void refresh();
      },
      (isConnected) => {
        setConnected(isConnected);
        if (isConnected && pollId !== null) {
          window.clearInterval(pollId);
          pollId = null;
        } else if (!isConnected && pollId === null) {
          pollId = window.setInterval(() => void refresh(), 2000);
        }
      },
    );

    return () => {
      if (pollId !== null) window.clearInterval(pollId);
      void unsubscribeFromRoom(channel);
    };
  }, [refresh, state?.room.id, state?.room.syncKey]);

  const run = useCallback(
    async (work: () => Promise<RoomState | null>) => {
      setPending(true);
      setError(null);
      try {
        const next = await work();
        if (next) acceptState(next);
        return next;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
        return null;
      } finally {
        setPending(false);
      }
    },
    [acceptState],
  );

  const create = useCallback((name: string) => run(() => createRoom(name)), [run]);
  const join = useCallback((code: string, name: string) => run(() => joinRoom(code, name)), [run]);
  const action = useCallback(
    async (name: ActionName) => {
      if (!stateRef.current) return null;
      const next = await run(() => performRoomAction(stateRef.current!.room.id, name));
      if (name === "leave_lobby" && next === null) {
        stateRef.current = null;
        setState(null);
      }
      return next;
    },
    [run],
  );
  const choose = useCallback(
    (price: Price) => {
      if (!stateRef.current) return Promise.resolve(null);
      return run(() => submitChoice(stateRef.current!.room.id, price));
    },
    [run],
  );
  const exit = useCallback(() => {
    forgetRoom();
    stateRef.current = null;
    setState(null);
    setError(null);
  }, []);

  return { state, booting, pending, connected, error, setError, create, join, action, choose, refresh, exit };
}

