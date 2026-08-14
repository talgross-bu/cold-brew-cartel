import type { Cart, GameResult, Price } from "./types";

export const CARTS: Cart[] = ["A", "B", "C"];
export const CART_COLORS: Record<Cart, string> = {
  A: "#d65d4a",
  B: "#285f50",
  C: "#678eaa",
};

export type CartOutcome = {
  price: Price;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
};

export type CalculatedResult = {
  lowCount: number;
  carts: Record<Cart, CartOutcome>;
  totalProfit: number;
};

export function calculateGame(prices: Record<Cart, Price>): CalculatedResult {
  const lowCount = CARTS.filter((cart) => prices[cart] === 3).length;
  const quantities: Record<Cart, number> = { A: 0, B: 0, C: 0 };

  for (const cart of CARTS) {
    if (lowCount === 0) quantities[cart] = 30;
    else if (lowCount === 1) quantities[cart] = prices[cart] === 3 ? 55 : 20;
    else if (lowCount === 2) quantities[cart] = prices[cart] === 3 ? 45 : 10;
    else quantities[cart] = 35;
  }

  const carts = Object.fromEntries(
    CARTS.map((cart) => {
      const price = prices[cart];
      const quantity = quantities[cart];
      const revenue = price * quantity;
      const cost = 55 + quantity;
      return [cart, { price, quantity, revenue, cost, profit: revenue - cost }];
    }),
  ) as Record<Cart, CartOutcome>;

  return {
    lowCount,
    carts,
    totalProfit: CARTS.reduce((sum, cart) => sum + carts[cart].profit, 0),
  };
}

export const OUTCOME_COPY = [
  {
    stamp: "The agreement held",
    title: "All three held the line.",
    subtitle: "The lunch crowd split evenly. Every cart kept a healthy margin.",
  },
  {
    stamp: "Someone broke ranks",
    title: "One cart grabbed the crowd.",
    subtitle: "A single $3 price pulled customers away from both $4 rivals.",
  },
  {
    stamp: "Price war begins",
    title: "Two carts undercut.",
    subtitle: "The last $4 cart was stranded while the discounters split the bargain hunters.",
  },
  {
    stamp: "The price war wins",
    title: "Everyone undercut.",
    subtitle: "No cart gained market share—and everyone kept the thinner margin.",
  },
] as const;

export function hydrateResult(result: GameResult): CalculatedResult {
  const calculated = calculateGame(result.prices);
  return {
    ...calculated,
    totalProfit: result.totalProfit,
    carts: Object.fromEntries(
      CARTS.map((cart) => [
        cart,
        {
          ...calculated.carts[cart],
          quantity: result.quantities[cart],
          profit: result.profits[cart],
        },
      ]),
    ) as Record<Cart, CartOutcome>,
  };
}

export function money(value: number): string {
  return value < 0 ? `−$${Math.abs(value)}` : `$${value}`;
}

