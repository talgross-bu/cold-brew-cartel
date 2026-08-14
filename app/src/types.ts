export type Cart = "A" | "B" | "C";
export type Price = 3 | 4;
export type Phase = "lobby" | "briefing" | "huddle" | "decision" | "result";

export type RoomPlayer = {
  cart: Cart;
  displayName: string;
  submitted: boolean;
};

export type GameResult = {
  prices: Record<Cart, Price>;
  quantities: Record<Cart, number>;
  profits: Record<Cart, number>;
  totalProfit: number;
  revealedAt: string;
};

export type RoomPermissions = {
  startGame: boolean;
  advanceBriefing: boolean;
  startHuddle: boolean;
  openDecision: boolean;
  reveal: boolean;
  playAgain: boolean;
  leaveLobby: boolean;
};

export type RoomState = {
  room: {
    id: string;
    code: string;
    phase: Phase;
    roundNumber: number;
    huddleEndsAt: string | null;
    version: number;
    expiresAt: string;
    serverNow: string;
    syncKey: string;
  };
  self: {
    playerId: string;
    cart: Cart;
    displayName: string;
    isSpokesperson: boolean;
    submitted: boolean;
    choice: Price | null;
  };
  players: RoomPlayer[];
  permissions: RoomPermissions;
  result: GameResult | null;
};

export type ActionName =
  | "start_game"
  | "advance_briefing"
  | "start_huddle"
  | "open_decision"
  | "reveal"
  | "play_again"
  | "leave_lobby";

