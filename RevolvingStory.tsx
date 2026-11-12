"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, BarChart3, CreditCard, ReceiptText, TrendingUp, Wallet } from "lucide-react";
import { BearMark } from "@/components/BearMark";
import { usePinnedProgress } from "@/components/usePinnedProgress";
import { useRealPointerMove } from "@/components/useRealPointerMove";

/* PayPal's brand blues, with a soft tint of its checkout yellow for the centre. */
const BRAND = {
  navy: "#012169",
  darkBlue: "#003087",
  blue: "#0070BA",
  lightBlue: "#009CDE",
  yellow: "#FFC439",
  softYellow: "#FFE7A3",
} as const;

const AGENTS = [
  {
    id: "invoice",
    name: "Invoice Agent",
    detail: "Drafts quotations and invoices, then tracks every due date and overdue balance.",
    icon: ReceiptText,
    color: BRAND.lightBlue,
  },
  {
    id: "payment",
    name: "Payment Agent",
    detail: "Reconciles collections through PayPal and prepares follow-ups for your approval.",
    icon: CreditCard,
    color: BRAND.yellow,
  },
  {
    id: "expense",
    name: "Expense Intelligence",
    detail: "Categorises spend automatically and flags unusual or creeping recurring costs.",
    icon: Wallet,
    color: "#5FB6E8",
  },
  {
    id: "cashflow",
    name: "Cash Flow Agent",
    detail: "Models 7, 30 and 90-day liquidity with every assumption written down.",
    icon: TrendingUp,
    color: "#8FD4F5",
  },
  {
    id: "bi",
    name: "Business Intelligence",
    detail: "Scores financial health and reads client payment behaviour for early risk.",
    icon: BarChart3,
    color: "#FFD98A",
  },
] as const;

type AgentId = (typeof AGENTS)[number]["id"];

const DEGREES_PER_SECOND = 12;
/** Extra rotation added across one full scroll through the scene. */
const SCROLL_TURN_DEGREES = 150;
const SPIN_UP_SECONDS = 0.9;
const RADIUS_X = 37;
const RADIUS_Y = 23;
const CENTRE_X = 50;
const CENTRE_Y = 50;
/** Agent i powers up over [0.04 + i·STEP, +RAMP]; the last is fully on at 80%. */
const POWER_STEP = 0.16;
const POWER_RAMP = 0.12;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const hexAlpha = (alpha: number) => Math.round(clamp01(alpha) * 255).toString(16).padStart(2, "0");
const agentPower = (progress: number, index: number) => clamp01((progress - 0.04 - index * POWER_STEP) / POWER_RAMP);

/**
 * Full-screen, scroll-driven agent network.
 *
 * The scene pins to the viewport. Scrolling (mouse wheel, trackpad or touch)
 * powers the agents on one by one, draws the ring around the orbit, fills the
 * PayPilot centre's progress border and turns the network. At 100% the scene
 * un-pins and the page scrolls on; scrolling back up reverses everything.
 *
 * The network also revolves on its own. Pointing at an agent or at the centre
 * holds it still until the pointer moves away; touch-and-hold does the same.
 */
export function RevolvingStory() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const touchHoldRef = useRef(false);
  const hoverHoldRef = useRef(false);
  const focusHoldRef = useRef(false);
  const speedRef = useRef(1);

  const progress = usePinnedProgress(wrapperRef);
  const isRealMove = useRealPointerMove();
  const progressRef = useRef(progress);
  const lastProgressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  const [angle, setAngle] = useState(0);
  const [size, setSize] = useState({ w: 1280, h: 800 });
  const [manual, setManual] = useState<{ id: AgentId; at: number } | null>(null);
  const [touching, setTouching] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const visibility = new IntersectionObserver(([entry]) => setOnScreen(entry?.isIntersecting ?? true));
    visibility.observe(node);
    const measure = () => {
      const rect = node.getBoundingClientRect();
      setSize((current) => (current.w === rect.width && current.h === rect.height ? current : { w: rect.width, h: rect.height }));
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(node);
    return () => {
      visibility.disconnect();
      resize.disconnect();
    };
  }, []);

  /* Steady revolution plus the extra turn contributed by scrolling. */
  useEffect(() => {
    if (reducedMotion || !onScreen) return;
    let frame = 0;
    let previous = performance.now();
    lastProgressRef.current = progressRef.current;
    const tick = (now: number) => {
      const seconds = Math.min(64, now - previous) / 1000;
      previous = now;
      const held = touchHoldRef.current || hoverHoldRef.current || focusHoldRef.current;
      speedRef.current = held ? 0 : Math.min(1, speedRef.current + seconds / SPIN_UP_SECONDS);
      const current = progressRef.current;
      const turn = held ? 0 : (current - lastProgressRef.current) * SCROLL_TURN_DEGREES;
      lastProgressRef.current = current;
      const spin = seconds * DEGREES_PER_SECOND * speedRef.current;
      if (spin !== 0 || turn !== 0) setAngle((value) => (((value + spin + turn) % 360) + 360) % 360);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, onScreen]);

  /* A finger or mouse button released anywhere ends the touch hold. */
  useEffect(() => {
    if (!touching) return;
    const letGo = () => {
      touchHoldRef.current = false;
      setTouching(false);
    };
    window.addEventListener("pointerup", letGo);
    window.addEventListener("pointercancel", letGo);
    window.addEventListener("blur", letGo);
    return () => {
      window.removeEventListener("pointerup", letGo);
      window.removeEventListener("pointercancel", letGo);
      window.removeEventListener("blur", letGo);
    };
  }, [touching]);

  /* Once the scroll moves the story to another agent, the scroll owns the brief again. */
  const powers = AGENTS.map((_, index) => agentPower(progress, index));
  const lit = powers.reduce((latest, power, index) => (power > 0.05 ? index : latest), -1);
  function holdOnHover() {
    if (hoverHoldRef.current) return;
    hoverHoldRef.current = true;
    setHovering(true);
  }
  function releaseHover() {
    hoverHoldRef.current = false;
    setHovering(false);
  }
  function releaseTouch() {
    if (!touchHoldRef.current) return;
    touchHoldRef.current = false;
    setTouching(false);
  }

  function positionAt(offsetDegrees: number) {
    const radians = ((angle + offsetDegrees) * Math.PI) / 180;
    const depth = (Math.sin(radians) + 1) / 2; // 0 = behind the centre, 1 = in front
    return {
      x: CENTRE_X + Math.cos(radians) * geometry.radiusX,
      y: geometry.centreY + Math.sin(radians) * geometry.radiusY,
      depth,
      scale: 0.8 + depth * 0.3,
      opacity: 0.55 + depth * 0.45,
      z: Math.round(depth * 20) + 2,
    };
  }

  const onlineCount = powers.filter((power) => power >= 0.999).length;
  const allOnline = onlineCount === AGENTS.length;
  const done = progress >= 0.995;
  const percent = Math.round(progress * 100);
  const activeIndex = manual && manual.at === lit ? AGENTS.findIndex((agent) => agent.id === manual.id) : Math.max(0, lit);
  const activeAgent = AGENTS[activeIndex];

  const eyebrow = allOnline ? "Your finance team" : lit >= 0 ? `Step ${lit + 1} of ${AGENTS.length}` : "Your finance team";
  const headline = allOnline
    ? "All five agents online. PayPilot is in control."
    : lit >= 0
      ? `${AGENTS[lit].name} ${powers[lit] >= 0.999 ? "is online" : "is coming online"}`
      : "Scroll to bring your finance team online";

  // Short or narrow screens need a smaller orbit so the headline, the ring and the
  // agent brief never collide. Centre drops slightly to keep room for the headline.
  const compact = size.h < 680 || size.w < 400;
  // Keep the orbit a real ellipse on phones: the horizontal radius stays wide so
  // front and back agents never pile onto the centre tile, and the tile itself
  // shrinks on very short screens to protect the vertical clearance.
  const tight = size.h < 620 || size.w < 340;
  const geometry = compact
    ? { centreY: 55, radiusX: 35, radiusY: Math.min(17.5, (size.h * 0.3) / (size.h / 100)) }
    : { centreY: CENTRE_Y, radiusX: RADIUS_X, radiusY: RADIUS_Y };
  const px = (xPercent: number) => (size.w * xPercent) / 100;
  const py = (yPercent: number) => (size.h * yPercent) / 100;
  const cx = px(CENTRE_X);
  const cy = py(geometry.centreY);
  const rx = px(geometry.radiusX);
  const ry = py(geometry.radiusY);
  const ringPath = `M ${cx} ${cy - ry} A ${rx} ${ry} 0 1 1 ${cx} ${cy + ry} A ${rx} ${ry} 0 1 1 ${cx} ${cy - ry}`;

  return (
    <div ref={wrapperRef} className="relative" style={{ height: "240svh" }}>
      <div
        ref={stageRef}
        role="group"
        aria-label="PayPilot agent network. Scroll to power the agents from zero to one hundred percent. Point at an agent to hold the network still."
        data-orbit-state={reducedMotion ? "still" : touching || hovering || focused ? "stopped" : "revolving"}
        data-story-progress={done ? "done" : "running"}
        data-story-percent={percent}
        onPointerDown={() => {
          touchHoldRef.current = true;
          setTouching(true);
        }}
        onPointerUp={releaseTouch}
        onPointerCancel={releaseTouch}
        onPointerLeave={releaseTouch}
        className="sticky top-0 isolate h-svh w-full touch-pan-y select-none overflow-hidden"
        style={{
          WebkitTouchCallout: "none",
          background: `radial-gradient(70% 60% at 50% 50%, ${BRAND.blue}${hexAlpha(0.18 + progress * 0.22)}, transparent 70%), radial-gradient(60% 55% at 85% 90%, ${BRAND.lightBlue}26, transparent 60%), linear-gradient(180deg, ${BRAND.darkBlue} 0%, ${BRAND.navy} 52%, #01102f 100%)`,
        }}
      >
        {/* Narration: changes as each agent comes online */}
        <div className="pointer-events-none absolute inset-x-0 top-[70px] z-30 px-4 text-center sm:top-[88px]">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#8fb2dc] sm:text-[11px] sm:tracking-[.2em]">{eyebrow}</p>
          <h2 key={headline} className="animate-fade-up mx-auto mt-1.5 max-w-3xl font-display text-lg font-extrabold leading-tight tracking-tight text-white min-[360px]:text-xl sm:mt-2 sm:text-[34px]">
            {headline}
          </h2>
        </div>

        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
          <defs>
            <linearGradient id="storyRing" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7fb6ff" />
              <stop offset="55%" stopColor={BRAND.lightBlue} />
              <stop offset="100%" stopColor={BRAND.softYellow} />
            </linearGradient>
            <radialGradient id="storyCentreGlow">
              <stop offset="0%" stopColor={BRAND.softYellow} stopOpacity={0.12 + progress * 0.22} />
              <stop offset="100%" stopColor={BRAND.softYellow} stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="rgba(255,231,163,.26)" strokeWidth="1" strokeDasharray="3 5" />
          {progress > 0.004 ? (
            <path
              d={ringPath}
              pathLength={100}
              fill="none"
              stroke="url(#storyRing)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={`${(progress * 100).toFixed(2)} 100`}
              data-story-ring
            />
          ) : null}
          <circle cx={cx} cy={cy} r={Math.min(size.w, size.h) * 0.28} fill="url(#storyCentreGlow)" />
          {AGENTS.map((agent, index) => {
            const point = positionAt(index * (360 / AGENTS.length));
            const power = powers[index];
            return (
              <line
                key={agent.id}
                x1={cx}
                y1={cy}
                x2={px(point.x)}
                y2={py(point.y)}
                stroke={power > 0.05 ? agent.color : BRAND.lightBlue}
                strokeOpacity={0.1 + power * 0.55}
                strokeWidth={1 + power}
              />
            );
          })}
          {[70, 200, 320].map((offset) => {
            const packet = positionAt(offset);
            return (
              <circle
                key={offset}
                cx={px(packet.x)}
                cy={py(packet.y)}
                r={2.2 + packet.depth * 2}
                fill={BRAND.softYellow}
                opacity={(0.25 + packet.depth * 0.5) * (0.4 + progress * 0.6)}
              />
            );
          })}
        </svg>

        {/* PayPilot centre: the border fills with scroll progress */}
        <div
          onPointerMove={(event) => {
            if (isRealMove(event)) holdOnHover();
          }}
          onPointerLeave={releaseHover}
          data-story-centre
          className="absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-[34px] p-[3px]"
          style={{
            left: `${CENTRE_X}%`,
            top: `${geometry.centreY}%`,
            background: `conic-gradient(from 0deg, ${BRAND.softYellow} ${(progress * 360).toFixed(1)}deg, rgba(255,255,255,.14) 0deg)`,
            boxShadow: `0 0 ${36 + progress * 46}px rgba(255,220,120,${(0.12 + progress * 0.26).toFixed(3)})`,
          }}
        >
          <div
            className={`flex ${tight ? "h-[92px] w-[92px]" : "h-[116px] w-[116px]"} flex-col items-center justify-center rounded-[28px] text-center sm:h-[144px] sm:w-[144px] sm:rounded-[31px]`}
            style={{ background: "linear-gradient(160deg, #fffdf4 0%, #ffefbb 100%)", color: BRAND.navy }}
          >
            <BearMark className={tight ? "h-6 w-6" : "h-8 w-8 sm:h-10 sm:w-10"} />
            <span className={`font-display font-extrabold leading-tight tracking-tight ${tight ? "mt-0.5 text-[12px]" : "mt-1.5 text-[13px] sm:text-sm"}`}>PayPilot</span>
            <span className={`text-[10px] font-bold uppercase tracking-[.06em] opacity-60 ${tight ? "mt-0" : "mt-0.5"}`}>
              {allOnline ? "All agents online" : `${percent}% powered`}
            </span>
          </div>
        </div>

        {/* Agents: dim and grey until scrolling powers each one on */}
        {AGENTS.map((agent, index) => {
          const point = positionAt(index * (360 / AGENTS.length));
          const power = powers[index];
          const isActive = index === activeIndex && power > 0.05;
          const Icon = agent.icon;
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => setManual({ id: agent.id, at: lit })}
              onPointerMove={(event) => {
                if (!isRealMove(event)) return;
                holdOnHover();
                setManual((current) => (current?.id === agent.id && current.at === lit ? current : { id: agent.id, at: lit }));
              }}
              onPointerLeave={releaseHover}
              onFocus={() => {
                setManual({ id: agent.id, at: lit });
                focusHoldRef.current = true;
                setFocused(true);
              }}
              onBlur={() => {
                focusHoldRef.current = false;
                setFocused(false);
              }}
              aria-pressed={isActive}
              aria-label={`${agent.name}${power >= 0.999 ? " (online)" : ""} — ${agent.detail}`}
              data-orbit-agent={agent.id}
              data-power={power.toFixed(2)}
              className={`absolute flex ${tight ? "h-[46px] w-[46px]" : "h-[54px] w-[54px]"} items-center justify-center rounded-2xl border backdrop-blur-[2px] transition-[border-color,background-color] duration-300 sm:h-[62px] sm:w-[62px]`}
              style={{
                left: `${point.x.toFixed(3)}%`,
                top: `${point.y.toFixed(3)}%`,
                zIndex: isActive ? 26 : point.z,
                opacity: Number((point.opacity * (0.35 + power * 0.65)).toFixed(3)),
                transform: `translate(-50%, -50%) scale(${(point.scale * (0.84 + power * 0.16) * (isActive ? 1.08 : 1)).toFixed(3)})`,
                borderColor: power > 0.5 ? `${agent.color}${hexAlpha(isActive ? 0.95 : 0.55)}` : "rgba(255,255,255,.14)",
                background:
                  power > 0.5
                    ? `linear-gradient(165deg, ${agent.color}${hexAlpha(isActive ? 0.3 : 0.16)}, #001a5299)`
                    : "linear-gradient(165deg, rgba(255,255,255,.08), rgba(0,26,82,.6))",
                boxShadow: `0 0 ${(8 + power * 26).toFixed(1)}px ${agent.color}${hexAlpha(power * (isActive ? 0.5 : 0.3))}`,
              }}
            >
              <Icon className={tight ? "h-5 w-5" : "h-6 w-6"} style={{ color: agent.color, filter: `grayscale(${(1 - power).toFixed(2)})` }} strokeWidth={1.9} />
              <span
                className="pointer-events-none absolute left-1/2 top-full mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-[#001a52]/80 px-2 py-0.5 text-[10px] font-bold text-white sm:block"
                style={{ opacity: power }}
              >
                {agent.name}
              </span>
            </button>
          );
        })}

        {/* Brief for the newest (or pointed-at) agent, plus per-agent power */}
        <div className="absolute inset-x-4 bottom-4 z-30 sm:inset-x-6 sm:bottom-6">
          <div className="mx-auto flex max-w-3xl items-center gap-4 rounded-2xl border border-white/12 bg-[#001a52]/80 px-4 py-3.5 backdrop-blur-md sm:px-5">
            <span
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex"
              style={{ background: `${activeAgent.color}26`, color: activeAgent.color }}
            >
              <activeAgent.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-extrabold tracking-tight text-white">{activeAgent.name}</span>
              <span className="mt-0.5 block truncate text-[11px] leading-snug text-[#b7cfe4]">{activeAgent.detail}</span>
            </span>
            <span className="w-32 shrink-0 sm:w-48">
              <span className="flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-[.08em]">
                <span className={allOnline ? "text-[#70d9ab]" : "text-[#9db4d6]"}>
                  {onlineCount}/{AGENTS.length} online
                </span>
                <span className="tabular-nums text-white" data-story-readout>
                  {percent}%
                </span>
              </span>
              <span className="mt-1.5 flex gap-1">
                {AGENTS.map((agent, index) => (
                  <span key={agent.id} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <span className="block h-full rounded-full" style={{ width: `${(powers[index] * 100).toFixed(1)}%`, background: agent.color }} />
                  </span>
                ))}
              </span>
            </span>
          </div>
          <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[.16em]" style={{ color: done ? "#70d9ab" : "#7f95b5" }}>
            <ArrowDown className={`h-4 w-4 ${done ? "" : "animate-bounce"}`} />
            {done ? "100% — keep scrolling to continue" : "Scroll to power the team"}
          </p>
        </div>
      </div>
    </div>
  );
}
