import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { CARTS, CART_COLORS, OUTCOME_COPY, hydrateResult, money } from "./gameRules";
import type { ActionName, Cart, Price, RoomPlayer, RoomState } from "./types";
import { useRoom } from "./useRoom";

const PHASES = ["lobby", "briefing", "huddle", "decision", "result"] as const;

function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "text";
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

function BrandHeader({ state, connected }: { state: RoomState | null; connected: boolean }) {
  const activeIndex = state ? PHASES.indexOf(state.room.phase) : -1;
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <span>The Cold Brew Cartel</span>
      </div>
      {state ? (
        <div className="header-status">
          {!connected && <span className="reconnecting">Reconnecting…</span>}
          <div className="progress" aria-label={`Game progress: ${state.room.phase}`}>
            {PHASES.map((phase, index) => (
              <span key={phase} className={`progress-dot ${index === activeIndex ? "active" : ""}`} />
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}

function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="sun" />
      <div className="building"><div className="windows" /></div>
      <div className="plaza" />
      <div className="hero-cups">
        {[0, 1, 2].map((cup) => (
          <div className="cup" key={cup}><div className="straw" /><div className="steam" /></div>
        ))}
      </div>
    </div>
  );
}

function Landing({
  pending,
  onCreate,
  onJoin,
}: {
  pending: boolean;
  onCreate: (name: string) => Promise<unknown>;
  onJoin: (code: string, name: string) => Promise<unknown>;
}) {
  const initialCode = new URLSearchParams(window.location.search).get("room") ?? "";
  const [mode, setMode] = useState<"choose" | "create" | "join">(initialCode ? "join" : "choose");
  const [name, setName] = useState("");
  const [code, setCode] = useState(initialCode);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode !== "choose") nameRef.current?.focus();
  }, [mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "create") await onCreate(name);
    if (mode === "join") await onJoin(code, name);
  }

  return (
    <section className="panel hero" aria-labelledby="intro-title">
      <div className="hero-copy">
        <p className="eyebrow">A 3-minute pricing game</p>
        <h1 id="intro-title">The Cold Brew <span className="accent">Cartel</span></h1>
        <p className="lead">Three rival coffee carts. One office-tower lunch rush. Can you all keep prices—and profits—high?</p>

        {mode === "choose" ? (
          <div className="landing-actions">
            <Button onClick={() => setMode("create")}>I’m the spokesperson <span aria-hidden="true">→</span></Button>
            <Button variant="secondary" onClick={() => setMode("join")}>Join my group</Button>
          </div>
        ) : (
          <form className="entry-form" onSubmit={submit}>
            <h2 className="form-title">{mode === "create" ? "Create your group" : "Join your group"}</h2>
            <p>{mode === "create" ? "You’ll receive a word to share and lead your group through the game." : "Enter the word your spokesperson gives you."}</p>
            {mode === "join" && (
              <label>
                Room word
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={12}
                  required
                />
              </label>
            )}
            <label>
              First name or nickname
              <input
                ref={nameRef}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="nickname"
                maxLength={24}
                required
                placeholder="Alex"
              />
            </label>
            <div className="button-row">
              <Button type="submit" disabled={pending}>{pending ? "Connecting…" : mode === "create" ? "Create room" : "Join room"}</Button>
              <Button type="button" variant="text" onClick={() => setMode("choose")} disabled={pending}>Back</Button>
            </div>
          </form>
        )}
        <p className="tiny-note">3 players · 3 devices · 1 decision</p>
      </div>
      <HeroArt />
    </section>
  );
}

function CartIcon({ cart, small = false }: { cart: Cart; small?: boolean }) {
  return (
    <div className={`cart-icon ${small ? "small" : ""}`} style={{ "--cart-color": CART_COLORS[cart] } as CSSProperties} aria-hidden="true">
      <div className="cart-canopy" />
      <div className="cart-body">CART {cart}</div>
      <div className="wheel left" /><div className="wheel right" />
    </div>
  );
}

function PlayerSeats({ players }: { players: RoomPlayer[] }) {
  return (
    <div className="seat-grid">
      {CARTS.map((cart) => {
        const player = players.find((entry) => entry.cart === cart);
        return (
          <article className={`seat-card ${player ? "filled" : ""}`} key={cart}>
            <CartIcon cart={cart} small />
            <div>
              <span className="seat-label">Cart {cart}</span>
              <strong>{player?.displayName ?? "Waiting for player"}</strong>
              {cart === "A" && <span className="role-tag">Spokesperson</span>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function Lobby({ state, pending, action }: ScreenProps) {
  const [copyMessage, setCopyMessage] = useState("");
  const joinUrl = `${window.location.origin}${window.location.pathname}?room=${state.room.code.toLowerCase()}`;

  async function copy(value: string, label: string) {
    const success = await copyText(value);
    setCopyMessage(success ? `${label} copied.` : `Copy this manually: ${value}`);
  }

  return (
    <ScreenPanel eyebrow="Your breakout group" title="Bring the cartel together." lead="Your spokesperson shares the room word. Each person joins on their own device.">
      <div className="code-card">
        <span>Tell your group to join with</span>
        <strong>{state.room.code.toUpperCase()}</strong>
        <div className="button-row centered-row">
          <Button variant="secondary" onClick={() => void copy(state.room.code.toUpperCase(), "Room word")}>Copy word</Button>
          <Button variant="secondary" onClick={() => void copy(joinUrl, "Joining link")}>Copy joining link</Button>
        </div>
        <span className="copy-status" role="status">{copyMessage}</span>
      </div>
      <PlayerSeats players={state.players} />
      <div className="center-actions">
        {state.self.isSpokesperson ? (
          <Button disabled={!state.permissions.startGame || pending} onClick={() => void action("start_game")}>Start the game <span aria-hidden="true">→</span></Button>
        ) : (
          <p className="waiting-message">Waiting for your spokesperson to start.</p>
        )}
        {state.permissions.leaveLobby && <Button variant="text" disabled={pending} onClick={() => void action("leave_lobby")}>Leave this room</Button>}
      </div>
    </ScreenPanel>
  );
}

type ScreenProps = {
  state: RoomState;
  pending: boolean;
  action: (name: ActionName) => Promise<unknown>;
};

function ScreenPanel({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel content-panel phase-screen" aria-labelledby="phase-heading">
      <div className="centered intro-block">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id="phase-heading" tabIndex={-1}>{title}</h2>
        {lead && <p className="lead centered-lead">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

function Briefing({ state, pending, action }: ScreenProps) {
  return (
    <ScreenPanel eyebrow="Your market" title={`You run Cart ${state.self.cart}. Maximize its profit.`} lead="You sell identical 16-ounce cold brews to the same office-tower lunch crowd.">
      <div className="rule-grid">
        <article className="rule-card"><span className="number">1</span><h3>Same product</h3><p>Customers buy from the lowest-priced cart. Ties split the crowd.</p></article>
        <article className="rule-card"><span className="number">2</span><h3>Same costs</h3><p>Opening your cart costs $55. Each cold brew costs another $1.</p></article>
        <article className="rule-card"><span className="number">3</span><h3>Your objective</h3><p>Earn as much profit as possible for your own cart.</p></article>
      </div>
      <div className="economics-strip" aria-label="Available prices">
        <div className="choice-card"><span className="choice-price">$4</span><h3>Hold the line</h3><p>Keep the high price.</p></div>
        <span className="or">OR</span>
        <div className="choice-card low"><span className="choice-price">$3</span><h3>Undercut</h3><p>Charge less than rivals.</p></div>
      </div>
      <div className="formula">Profit = (price − $1) × cups sold − $55</div>
      <div className="center-actions">
        {state.permissions.advanceBriefing ? (
          <Button disabled={pending} onClick={() => void action("advance_briefing")}>Got it—start the huddle</Button>
        ) : <p className="waiting-message">Waiting for your spokesperson.</p>}
      </div>
    </ScreenPanel>
  );
}

function Huddle({ state, pending, action }: ScreenProps) {
  const offset = useMemo(() => Date.parse(state.room.serverNow) - Date.now(), [state.room.serverNow]);
  const [now, setNow] = useState(Date.now());
  const end = state.room.huddleEndsAt ? Date.parse(state.room.huddleEndsAt) : null;
  const remainingMs = end ? Math.max(0, end - (now + offset)) : 20_000;
  const seconds = end ? Math.ceil(remainingMs / 1000) : 20;
  const progress = end ? Math.max(0, Math.min(100, (remainingMs / 20_000) * 100)) : 100;

  useEffect(() => {
    if (!end) return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [end]);

  return (
    <section className="panel content-panel" aria-labelledby="huddle-heading">
      <div className="negotiation-layout">
        <div className="timer-wrap">
          <div className="timer" style={{ "--timer-progress": `${progress}%` } as CSSProperties}>
            <div className="timer-content"><span className="timer-number">{seconds}</span><span className="timer-label">seconds</span></div>
          </div>
        </div>
        <div>
          <p className="eyebrow">Cartel huddle</p>
          <h2 id="huddle-heading" tabIndex={-1}>Talk prices.</h2>
          <p className="lead">You may make any agreement you like. Promises are allowed—but nothing makes them binding.</p>
          <div className="speech">“What if we all charge $4?”</div>
          <div className="mini-carts" aria-hidden="true">{CARTS.map((cart) => <CartIcon cart={cart} small key={cart} />)}</div>
          <div className="button-row">
            {state.permissions.startHuddle && !end && <Button disabled={pending} onClick={() => void action("start_huddle")}>Start 20-second huddle</Button>}
            {state.permissions.openDecision && <Button variant={end ? "secondary" : "text"} disabled={pending} onClick={() => void action("open_decision")}>{end ? "Make the decision" : "Skip huddle"} <span aria-hidden="true">→</span></Button>}
            {!state.self.isSpokesperson && <p className="waiting-message">Your spokesperson controls the huddle.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Readiness({ players }: { players: RoomPlayer[] }) {
  return (
    <div className="readiness" aria-label="Player readiness">
      {CARTS.map((cart) => {
        const player = players.find((entry) => entry.cart === cart);
        return (
          <div className={`ready-row ${player?.submitted ? "ready" : ""}`} key={cart}>
            <span><strong>Cart {cart}</strong> · {player?.displayName}</span>
            <span>{player?.submitted ? "✓ Ready" : "Choosing…"}</span>
          </div>
        );
      })}
    </div>
  );
}

function Decision({ state, pending, action, choose }: ScreenProps & { choose: (price: Price) => Promise<unknown> }) {
  const [selected, setSelected] = useState<Price | null>(null);

  return (
    <ScreenPanel eyebrow="The only lunch rush" title="Choose privately." lead="Your choice locks when you submit, and no one—not even your spokesperson—can see it before the reveal.">
      <div className="decision-card">
        <CartIcon cart={state.self.cart} />
        {!state.self.submitted ? (
          <div className="decision-controls">
            <h3>What will Cart {state.self.cart} charge?</h3>
            <div className="price-options" role="group" aria-label="Choose your price">
              {[3, 4].map((price) => (
                <button
                  key={price}
                  className={selected === price ? "selected" : ""}
                  aria-pressed={selected === price}
                  onClick={() => setSelected(price as Price)}
                  disabled={pending}
                >
                  <span>${price}</span>
                  <small>{price === 3 ? "Undercut" : "Hold the line"}</small>
                </button>
              ))}
            </div>
            <Button disabled={!selected || pending} onClick={() => selected && void choose(selected)}>Lock in {selected ? `$${selected}` : "your price"}</Button>
            <p className="tiny-note">You cannot change this choice after submitting.</p>
          </div>
        ) : (
          <div className="locked-choice">
            <span>Your locked price</span>
            <strong>${state.self.choice}</strong>
          </div>
        )}
      </div>
      <Readiness players={state.players} />
      <div className="center-actions">
        {state.self.isSpokesperson && (
          <Button disabled={!state.permissions.reveal || pending} onClick={() => void action("reveal")}>Reveal the market</Button>
        )}
        {!state.self.isSpokesperson && state.players.every((player) => player.submitted) && (
          <p className="waiting-message">Waiting for your spokesperson to reveal the market.</p>
        )}
      </div>
    </ScreenPanel>
  );
}

function Result({ state, pending, action }: ScreenProps) {
  if (!state.result) return null;
  const calculated = hydrateResult(state.result);
  const copy = OUTCOME_COPY[calculated.lowCount];

  return (
    <section className="panel result-panel" aria-labelledby="result-heading">
      <div className="result-header">
        <span className="outcome-stamp">{copy.stamp}</span>
        <h2 id="result-heading" tabIndex={-1}>{copy.title}</h2>
        <p>{copy.subtitle}</p>
      </div>
      <div className="market-scene">
        <div className="result-carts">
          {CARTS.map((cart) => {
            const data = calculated.carts[cart];
            const playerName = state.players.find((player) => player.cart === cart)?.displayName ?? `Cart ${cart}`;
            return (
              <article className="result-cart" key={cart} style={{ "--cart-color": CART_COLORS[cart] } as CSSProperties}>
                <div className={`price-sign ${data.price === 3 ? "low" : ""}`}>${data.price}</div>
                <CartIcon cart={cart} />
                <strong className="result-player-name">{playerName}</strong>
                <span className="cup-count">{data.quantity} cups sold</span>
              </article>
            );
          })}
        </div>
      </div>
      <div className="result-body">
        <div className="profit-grid">
          {CARTS.map((cart) => {
            const data = calculated.carts[cart];
            const playerName = state.players.find((player) => player.cart === cart)?.displayName ?? `Cart ${cart}`;
            return (
              <article className={`profit-card ${data.profit < 0 ? "loss" : ""}`} key={cart}>
                <span className="cart-name"><strong>{playerName}</strong><small>Cart {cart} register</small></span>
                <div className="profit">{money(data.profit)}</div>
                <div className="math-line"><span>Revenue</span><strong>{money(data.revenue)}</strong></div>
                <div className="math-line"><span>Opening + cup costs</span><strong>−{money(data.cost)}</strong></div>
              </article>
            );
          })}
        </div>
        <section className="aha-card" aria-labelledby="aha-heading">
          <p className="eyebrow dark-eyebrow">The reveal</p>
          <h3 id="aha-heading">Undercutting always pays one cart.</h3>
          <p>Hold your rivals’ prices fixed. Your cart earns more by choosing $3 in every possible situation:</p>
          <div className="table-scroll">
            <table className="dominance-table">
              <thead><tr><th>Rivals charging $3</th><th>You choose $4</th><th>You choose $3</th><th>Your gain</th></tr></thead>
              <tbody>
                <tr><td>Neither rival</td><td>$35</td><td>$55</td><td>+$20</td></tr>
                <tr><td>One rival</td><td>$5</td><td>$35</td><td>+$30</td></tr>
                <tr><td>Both rivals</td><td>−$25</td><td>$15</td><td>+$40</td></tr>
              </tbody>
            </table>
          </div>
          <div className="comparison">
            <div className="bar-card"><div className="bar-label"><span>If all carts hold at $4</span><strong>$105 total</strong></div><div className="bar-track"><div className="bar-fill" style={{ width: "100%" }} /></div></div>
            <div className="bar-card actual"><div className="bar-label"><span>Your market</span><strong>{money(calculated.totalProfit)} total</strong></div><div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(0, calculated.totalProfit / 105 * 100)}%` }} /></div></div>
          </div>
          <div className="final-lesson">What is rational for each cart is worse for all three: if everyone undercuts, each earns $15 instead of $35.</div>
          <div className="concept-tags"><span>Cartel instability</span><span>Dominant strategy</span><span>Prisoner’s dilemma</span></div>
        </section>
        <p className="question">If everyone promised $4, why was that promise hard to trust?</p>
        <div className="center-actions">
          {state.permissions.playAgain ? <Button disabled={pending} onClick={() => void action("play_again")}>Play again</Button> : <p className="waiting-message">Waiting for your spokesperson to start another round.</p>}
        </div>
      </div>
    </section>
  );
}

export function App() {
  const room = useRoom();
  const headingKey = room.state ? `${room.state.room.id}:${room.state.room.phase}:${room.state.room.roundNumber}` : "landing";

  useEffect(() => {
    if (!room.state) return;
    const heading = document.querySelector<HTMLElement>("#phase-heading, #huddle-heading, #result-heading");
    heading?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [headingKey, room.state]);

  if (room.booting) {
    return <div className="boot-screen"><span className="brand-mark" /><p>Opening the carts…</p></div>;
  }

  return (
    <div className="app-shell">
      <BrandHeader state={room.state} connected={room.connected} />
      <main>
        {room.error && (
          <div className="error-banner" role="alert">
            <span>{room.error}</span>
            {room.state && <Button variant="text" onClick={() => void room.refresh()}>Try again</Button>}
          </div>
        )}
        {!room.state && <Landing pending={room.pending} onCreate={room.create} onJoin={room.join} />}
        {room.state?.room.phase === "lobby" && <Lobby state={room.state} pending={room.pending} action={room.action} />}
        {room.state?.room.phase === "briefing" && <Briefing state={room.state} pending={room.pending} action={room.action} />}
        {room.state?.room.phase === "huddle" && <Huddle state={room.state} pending={room.pending} action={room.action} />}
        {room.state?.room.phase === "decision" && <Decision state={room.state} pending={room.pending} action={room.action} choose={room.choose} />}
        {room.state?.room.phase === "result" && <Result state={room.state} pending={room.pending} action={room.action} />}
      </main>
      <div className="screen-reader-only" aria-live="polite">{room.error ?? (room.connected ? "" : "Reconnecting to your group")}</div>
    </div>
  );
}
