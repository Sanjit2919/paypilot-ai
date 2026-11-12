"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, BarChart3, CreditCard, ReceiptText, TrendingUp, Wallet } from "lucide-react";
import { BearMark } from "@/components/BearMark";
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

const DEGREES_PER_SECOND = 15;
const SPIN_UP_SECONDS = 0.9;
const CENTRE_X = 50;
const RADIUS_X = 34;
const RADIUS_Y = 19;
const CENTRE_Y = 40;
/** Bottom band reserved for the selected-agent caption. */
const CAPTION_BAND = 96;

/**
 * The agent network revolves continuously. It holds still while the pointer is
 * over the network, while an agent is focused, or while the surface is being
 * touched. There is no timed resume: it stays stopped until the pointer leaves
 * or the touch ends. In embedded mode it becomes part of the parent dashboard
 * panel instead of drawing a separate card around itself.
 */
export function LiveAgentOrbit({
  embedded = false,
  className = "",
}: {
  embedded?: boolean;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const touchHoldRef = useRef(false);
  const hoverHoldRef = useRef(false);
  const focusHoldRef = useRef(false);
  const speedRef = useRef(1);
  const isRealMove = useRealPointerMove();

  const [angle, setAngle] = useState(0);
  const [selected, setSelected] = useState<AgentId>("payment");
  const [touching, setTouching] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [ring, setRing] = useState({ radiusY: RADIUS_Y, centreY: CENTRE_Y });

  /* Keep the ring inside the panel and clear of the caption underneath it. */
  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const measure = () => {
      const height = node.clientHeight || 360;
      const width = node.clientWidth || 380;
      // Room between the top of the panel and the caption band.
      // Space left for the ring once the caption band is reserved.
      const available = Math.max(120, height - CAPTION_BAND);
      // The front/back agents sit at ±radiusY from the tile centre. Their nearest
      // edges must stay outside the tile: radiusY >= tileHalf + agentHalf + margin.
      const small = width < 360;
      const tileHalf = small ? 39 : width < 520 ? 39 : 48;
      const agentHalf = small ? 21.5 : width < 520 ? 23 : 26;
      const margin = 10;
      const minRadius = tileHalf + agentHalf + margin;
      const maxRadius = available / 2 - agentHalf - 4;
      const radiusYpx = Math.max(minRadius, Math.min(maxRadius, available * 0.34));
      setRing({
        radiusY: (radiusYpx / height) * 100,
        centreY: ((available / 2) / height) * 100,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  /* No frames are drawn while the network is entirely off screen. */
  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry?.isIntersecting ?? true));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* The revolution: one animation-frame loop driven by the hold refs. */
  useEffect(() => {
    if (reducedMotion || !onScreen) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const seconds = Math.min(64, now - previous) / 1000;
      previous = now;
      const held = touchHoldRef.current || hoverHoldRef.current || focusHoldRef.current;
      if (held) speedRef.current = 0;
      else speedRef.current = Math.min(1, speedRef.current + seconds / SPIN_UP_SECONDS);
      if (speedRef.current > 0) {
        const step = seconds * DEGREES_PER_SECOND * speedRef.current;
        setAngle((current) => (current + step) % 360);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, onScreen]);

  /* If the finger or mouse button is released anywhere, the touch hold ends. */
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

  function releaseTouch() {
    if (!touchHoldRef.current) return;
    touchHoldRef.current = false;
    setTouching(false);
  }

  function positionAt(offsetDegrees: number) {
    const radians = ((angle + offsetDegrees) * Math.PI) / 180;
    const depth = (Math.sin(radians) + 1) / 2; // 0 = behind the centre, 1 = in front
    return {
      x: CENTRE_X + Math.cos(radians) * RADIUS_X,
      y: ring.centreY + Math.sin(radians) * ring.radiusY,
      depth,
      scale: 0.76 + depth * 0.34,
      opacity: 0.5 + depth * 0.5,
      z: Math.round(depth * 20) + 2,
    };
  }

  const active = AGENTS.find((agent) => agent.id === selected) ?? AGENTS[0];
  const held = touching || hovering || focused;

  return (
    <div
      ref={boxRef}
      role="group"
      aria-label="Revolving PayPilot agent network. Point at the network to hold it still; move away to let it revolve again."
      data-orbit-state={reducedMotion ? "still" : held ? "stopped" : "revolving"}
      onPointerDown={() => {
        touchHoldRef.current = true;
        setTouching(true);
      }}
      onPointerUp={releaseTouch}
      onPointerCancel={releaseTouch}
      onPointerMove={(event) => {
        if (hoverHoldRef.current || !isRealMove(event)) return;
        hoverHoldRef.current = true;
        setHovering(true);
      }}
      onPointerLeave={() => {
        hoverHoldRef.current = false;
        setHovering(false);
        releaseTouch();
      }}
      className={`relative w-full touch-pan-y select-none overflow-hidden ${
        embedded
          ? "h-[330px] sm:h-[380px]"
          : "h-[392px] rounded-[25px] border border-white/12 shadow-[0_28px_90px_-38px_rgba(1,33,105,.85)] sm:h-[436px]"
      } ${className}`}
      style={{
        WebkitTouchCallout: "none",
        background: embedded
          ? `radial-gradient(70% 62% at 50% 44%, ${BRAND.lightBlue}24, transparent 68%), radial-gradient(45% 38% at 50% 44%, ${BRAND.softYellow}12, transparent 70%)`
          : `radial-gradient(120% 90% at 16% 0%, ${BRAND.blue}59, transparent 58%), radial-gradient(90% 80% at 100% 100%, ${BRAND.lightBlue}30, transparent 60%), linear-gradient(160deg, ${BRAND.darkBlue} 0%, ${BRAND.navy} 70%, #011a55 100%)`,
      }}
    >
      {/* Orbit path, spokes and the packets that travel with the revolution */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="orbitSpoke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={BRAND.lightBlue} stopOpacity=".42" />
            <stop offset="100%" stopColor={BRAND.lightBlue} stopOpacity=".05" />
          </linearGradient>
          <radialGradient id="orbitCentreGlow">
            <stop offset="0%" stopColor={BRAND.softYellow} stopOpacity=".2" />
            <stop offset="100%" stopColor={BRAND.softYellow} stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse
          cx={CENTRE_X}
          cy={ring.centreY}
          rx={RADIUS_X}
          ry={ring.radiusY}
          fill="none"
          stroke="rgba(255,231,163,.36)"
          strokeWidth="1"
          strokeDasharray="2 2.6"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={CENTRE_X} cy={ring.centreY} r="21" fill="url(#orbitCentreGlow)" />
        {AGENTS.map((agent, index) => {
          const point = positionAt(index * (360 / AGENTS.length));
          return (
            <line
              key={agent.id}
              x1={CENTRE_X}
              y1={ring.centreY}
              x2={point.x.toFixed(3)}
              y2={point.y.toFixed(3)}
              stroke="url(#orbitSpoke)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {[70, 200, 320].map((offset) => {
          const packet = positionAt(offset);
          return (
            <circle
              key={offset}
              cx={packet.x.toFixed(3)}
              cy={packet.y.toFixed(3)}
              r={(0.55 + packet.depth * 0.55).toFixed(3)}
              fill={BRAND.softYellow}
              opacity={(0.35 + packet.depth * 0.55).toFixed(3)}
            />
          );
        })}
      </svg>

      {/* PayPilot centre — bear mark on a light, soft yellow tile */}
      <div
        className="absolute z-30 flex h-[78px] w-[78px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-[20px] border text-center sm:h-[96px] sm:w-[96px] sm:rounded-[24px]"
        style={{
          left: `${CENTRE_X}%`,
          top: `${ring.centreY}%`,
          borderColor: "#fff6d6",
          background: "linear-gradient(160deg, #fffdf4 0%, #ffefbb 100%)",
          boxShadow: "0 0 38px rgba(255,220,120,.2), inset 0 1px 0 rgba(255,255,255,.9)",
          color: BRAND.navy,
        }}
      >
        <BearMark className="h-5 w-5 sm:h-6 sm:w-6" />
        <span className="mt-1 font-display text-[11px] font-extrabold leading-tight tracking-tight">PayPilot</span>
        <span className="text-[10px] font-bold uppercase tracking-[.07em] opacity-60">You stay in control</span>
      </div>

      {/* Revolving agents: pointing at one selects it and holds the orbit still. */}
      {AGENTS.map((agent, index) => {
        const point = positionAt(index * (360 / AGENTS.length));
        const isActive = agent.id === selected;
        const Icon = agent.icon;
        return (
          <button
            key={agent.id}
            type="button"
            onClick={() => setSelected(agent.id)}
            onPointerMove={(event) => {
              if (!isRealMove(event)) return;
              setSelected((current) => (current === agent.id ? current : agent.id));
              if (hoverHoldRef.current) return;
              hoverHoldRef.current = true;
              setHovering(true);
            }}
            onFocus={() => {
              setSelected(agent.id);
              focusHoldRef.current = true;
              setFocused(true);
            }}
            onBlur={() => {
              focusHoldRef.current = false;
              setFocused(false);
            }}
            aria-pressed={isActive}
            aria-label={`${agent.name} — ${agent.detail}`}
            title={agent.name}
            data-orbit-agent={agent.id}
            className="absolute flex h-[46px] w-[46px] items-center justify-center rounded-[15px] border backdrop-blur-[2px] transition-[box-shadow,border-color,background-color] duration-300 sm:h-[52px] sm:w-[52px]"
            style={{
              left: `${point.x.toFixed(3)}%`,
              top: `${point.y.toFixed(3)}%`,
              zIndex: isActive ? 26 : point.z,
              opacity: isActive ? 1 : Number(point.opacity.toFixed(3)),
              transform: `translate(-50%, -50%) scale(${(isActive ? Math.max(point.scale, 1.06) : point.scale).toFixed(3)})`,
              borderColor: isActive ? `${agent.color}e6` : "rgba(255,255,255,.16)",
              background: isActive
                ? `linear-gradient(165deg, ${agent.color}3d, #001a5299)`
                : "linear-gradient(165deg, rgba(255,255,255,.13), rgba(0,26,82,.62))",
              boxShadow: isActive ? `0 0 30px ${agent.color}59` : "0 8px 22px -14px rgba(0,12,33,.9)",
            }}
          >
            <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" style={{ color: isActive ? agent.color : "#dce9f5" }} strokeWidth={1.9} />
          </button>
        );
      })}

      {/* Selected agent brief */}
      <div className={`absolute z-30 ${embedded ? "inset-x-1 bottom-1" : "inset-x-4 bottom-4 sm:inset-x-5 sm:bottom-5"}`}>
        <div
          className="flex items-center gap-3 rounded-[16px] border px-4 py-3 text-left backdrop-blur-md"
          style={{
            borderColor: embedded ? "rgba(255,255,255,.12)" : `${active.color}40`,
            background: embedded ? "rgba(255,255,255,.06)" : "rgba(0,18,58,.82)",
          }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]"
            style={{ background: `${active.color}26`, color: active.color }}
          >
            <active.icon className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-extrabold tracking-tight text-white">{active.name}</span>
            <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-[#b7cfe4] sm:line-clamp-1">{active.detail}</span>
          </span>
          <ArrowUpRight className="h-4 w-4 shrink-0" style={{ color: `${active.color}cc` }} />
        </div>
      </div>
    </div>
  );
}
