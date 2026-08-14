import { describe, expect, it } from "vitest";
import { calculateGame } from "./gameRules";
import type { Cart, Price } from "./types";

const fixtures: Array<{
  profile: string;
  quantities: number[];
  profits: number[];
  total: number;
}> = [
  { profile: "333", quantities: [35, 35, 35], profits: [15, 15, 15], total: 45 },
  { profile: "334", quantities: [45, 45, 10], profits: [35, 35, -25], total: 45 },
  { profile: "343", quantities: [45, 10, 45], profits: [35, -25, 35], total: 45 },
  { profile: "344", quantities: [55, 20, 20], profits: [55, 5, 5], total: 65 },
  { profile: "433", quantities: [10, 45, 45], profits: [-25, 35, 35], total: 45 },
  { profile: "434", quantities: [20, 55, 20], profits: [5, 55, 5], total: 65 },
  { profile: "443", quantities: [20, 20, 55], profits: [5, 5, 55], total: 65 },
  { profile: "444", quantities: [30, 30, 30], profits: [35, 35, 35], total: 105 },
];

describe("calculateGame", () => {
  it.each(fixtures)("matches the $profile payoff fixture", ({ profile, quantities, profits, total }) => {
    const carts: Cart[] = ["A", "B", "C"];
    const prices = Object.fromEntries(
      carts.map((cart, index) => [cart, Number(profile[index]) as Price]),
    ) as Record<Cart, Price>;
    const result = calculateGame(prices);

    expect(carts.map((cart) => result.carts[cart].quantity)).toEqual(quantities);
    expect(carts.map((cart) => result.carts[cart].profit)).toEqual(profits);
    expect(result.totalProfit).toBe(total);
  });
});

