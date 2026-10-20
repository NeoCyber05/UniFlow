import type { CSSProperties, ReactNode } from "react";
import { tr } from "@/lib/i18n";

/** Hand-drawn SVG scenes for the onboarding tour. Animation classes (`ob-*`) live in web/globals.css. */

const delay = (seconds: number) => ({ "--d": `${seconds}s` }) as CSSProperties;

const Svg = ({ className, children }: { className?: string; children: ReactNode }) => (
  <svg viewBox="0 0 240 150" fill="none" aria-hidden className={className}>
    {children}
  </svg>
);

/** Four-point sparkle centred on (cx, cy). */
const star = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z`;

const SURFACE = "fill-card stroke-border";

/* 1 · Welcome: one board per workspace, one list per course */
const COLUMNS = [
  { x: 34, accent: "fill-violet-500", cards: 3 },
  { x: 94, accent: "fill-amber-400", cards: 2 },
  { x: 154, accent: "fill-emerald-400", cards: 1 },
];

const BoardArt = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <rect x="20" y="14" width="200" height="122" rx="14" className={SURFACE} />
    <rect x="34" y="26" width="64" height="8" rx="4" className="fill-violet-500" />
    <circle cx="176" cy="30" r="4" className="fill-muted-foreground/30" />
    <circle cx="188" cy="30" r="4" className="fill-muted-foreground/30" />
    {COLUMNS.map((col, c) => (
      <g key={col.x}>
        <rect x={col.x} y="44" width="52" height="82" rx="8" className="fill-muted" />
        <rect x={col.x + 8} y="52" width="24" height="5" rx="2.5" className={col.accent} />
        {Array.from({ length: col.cards }, (_, i) => (
          <g key={i} className="ob-pop" style={delay(0.1 + c * 0.12 + i * 0.1)}>
            <rect x={col.x + 6} y={64 + i * 18} width="40" height="14" rx="4" className={SURFACE} />
            <rect x={col.x + 10} y={69 + i * 18} width={i % 2 ? 18 : 26} height="3" rx="1.5" className="fill-muted-foreground/40" />
          </g>
        ))}
      </g>
    ))}
    <circle cx="94" cy="97" r="4" className="fill-emerald-500" />
    <g className="ob-float">
      <circle cx="212" cy="20" r="15" className="fill-violet-500" />
      <path d="M204 19.5 212 15.5 220 19.5 212 23.5Z" className="fill-white" />
      <path d="M207.5 22v4.5c2.5 2 6.5 2 9 0V22" className="stroke-white" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M220 19.5v6" className="stroke-white" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  </Svg>
);

/* 2 · Quick add: type #course @date ! and the card builds itself */
const QuickAddArt = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <rect x="16" y="16" width="208" height="36" rx="11" className="fill-card stroke-violet-400" strokeWidth="1.5" />
    <path d="M32 29v10M27 34h10" className="stroke-violet-500" strokeWidth="2" strokeLinecap="round" />
    {[
      { x: 46, w: 36, label: "#GT1", tone: "fill-violet-500/20", text: "fill-violet-500" },
      { x: 86, w: 32, label: "@t6", tone: "fill-amber-400/25", text: "fill-amber-500" },
      { x: 122, w: 20, label: "!", tone: "fill-red-500/20", text: "fill-red-500" },
    ].map((chip, i) => (
      <g key={chip.label} className="ob-pop" style={delay(0.15 + i * 0.25)}>
        <rect x={chip.x} y="26" width={chip.w} height="16" rx="8" className={chip.tone} />
        <text x={chip.x + chip.w / 2} y="37.5" textAnchor="middle" fontSize="9.5" fontWeight="600" className={chip.text}>
          {chip.label}
        </text>
      </g>
    ))}
    <rect x="148" y="27" width="1.5" height="14" rx=".75" className="ob-blink fill-foreground" />

    <path d="M120 58v14" className="ob-dash stroke-violet-400" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="3 4" />
    <path d="m114.5 69.5 5.5 6 5.5-6" className="stroke-violet-400" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path className="ob-twinkle fill-violet-400" d={star(150, 66, 5)} />

    <g className="ob-pop" style={delay(0.9)}>
      <rect x="40" y="82" width="160" height="54" rx="11" className={SURFACE} />
      <rect x="40" y="94" width="3.5" height="30" rx="1.75" className="fill-violet-500" />
      <circle cx="60" cy="102" r="7" className="stroke-muted-foreground/50" strokeWidth="1.6" />
      <rect x="74" y="98" width="82" height="5.5" rx="2.75" className="fill-foreground/70" />
      <rect x="74" y="112" width="30" height="10" rx="5" className="fill-violet-500/25" />
      <rect x="108" y="112" width="38" height="10" rx="5" className="fill-amber-400/30" />
      <path d="M180 94v18M180 95h12l-3 4.5 3 4.5h-12" className="stroke-red-500" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </Svg>
);

/* 3 · Calendar: drag a task to a new day, get a reminder */
const CalendarArt = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <rect x="22" y="12" width="196" height="126" rx="13" className={SURFACE} />
    <rect x="34" y="23" width="52" height="6" rx="3" className="fill-foreground/70" />
    <rect x="178" y="22" width="8" height="8" rx="3" className="fill-muted" />
    <rect x="190" y="22" width="8" height="8" rx="3" className="fill-muted" />
    {Array.from({ length: 28 }, (_, i) => {
      const col = i % 7;
      const row = Math.floor(i / 7);
      const today = i === 9;
      return (
        <g key={i}>
          <rect
            x={34 + col * 24}
            y={42 + row * 23}
            width="20"
            height="17"
            rx="4"
            className={today ? "fill-violet-500/15 stroke-violet-500" : "fill-muted"}
            strokeWidth="1.2"
          />
          {(i === 3 || i === 15 || i === 23) && <rect x={37 + col * 24} y={52 + row * 23} width="14" height="4" rx="2" className="fill-sky-400" />}
        </g>
      );
    })}
    <rect x="130" y="88" width="20" height="17" rx="4" className="fill-violet-500/10 stroke-violet-400" strokeWidth="1.2" strokeDasharray="3 2.5" />
    <g className="ob-drag">
      <rect x="56" y="65" width="26" height="12" rx="6" className="fill-violet-500" />
      <rect x="62" y="69.5" width="14" height="3" rx="1.5" className="fill-white/90" />
      <path d="M72 76.5v12l3-2.5 2.5 5.5 2.5-1-2.5-5.5h4Z" className="fill-foreground stroke-card" strokeWidth="1" strokeLinejoin="round" />
    </g>
    <g className="ob-ring">
      <circle cx="210" cy="20" r="14" className="fill-amber-400" />
      <path d="M210 13a5 5 0 0 1 5 5v3.5l2 3h-14l2-3V18a5 5 0 0 1 5-5Z" className="fill-white" />
      <circle cx="210" cy="27.5" r="2" className="fill-white" />
    </g>
  </Svg>
);

/* 4 · AI: a long pasted note becomes separate tasks */
const NOTE_LINES = [52, 38, 56, 44, 56, 30, 48];
const TASKS = [
  { y: 24, bar: 36, chip: "fill-amber-400/35" },
  { y: 56, bar: 28, chip: "fill-sky-400/35" },
  { y: 88, bar: 40, chip: "fill-emerald-400/35" },
];

const AiArt = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <rect x="12" y="20" width="78" height="110" rx="9" className={SURFACE} />
    {NOTE_LINES.map((w, i) => (
      <g key={i}>
        {(i === 1 || i === 4) && <rect x="18" y={38 + i * 12} width={w + 14} height="9" rx="3" className="fill-amber-400/25" />}
        <rect x="24" y={40 + i * 12} width={w} height="4" rx="2" className="fill-muted-foreground/40" />
      </g>
    ))}
    <path d="M94 75h12M134 75h12" className="ob-dash stroke-violet-400" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="3 4" />
    <g className="ob-float">
      <path d={star(120, 75, 14)} className="fill-violet-500" />
      <path className="ob-twinkle fill-violet-400" d={star(136, 54, 5)} />
      <path className="ob-twinkle fill-fuchsia-400" style={delay(0.8)} d={star(104, 100, 4)} />
    </g>
    {TASKS.map((t, i) => (
      <g key={t.y} className="ob-pop" style={delay(0.2 + i * 0.2)}>
        <rect x="150" y={t.y} width="80" height="30" rx="8" className={SURFACE} />
        <rect x="158" y={t.y + 10} width="10" height="10" rx="3" className="stroke-violet-500" strokeWidth="1.6" />
        <rect x="174" y={t.y + 8} width={t.bar} height="4.5" rx="2.25" className="fill-foreground/70" />
        <rect x="174" y={t.y + 17} width="24" height="5" rx="2.5" className={t.chip} />
      </g>
    ))}
  </Svg>
);

/* 5 · Capture: highlight a teacher's message, send it to UniFlow */
const CaptureArt = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <rect x="12" y="14" width="152" height="122" rx="12" className={SURFACE} />
    <circle cx="28" cy="30" r="7" className="fill-sky-400" />
    <rect x="40" y="26" width="40" height="5" rx="2.5" className="fill-foreground/70" />
    <rect x="40" y="34" width="24" height="3.5" rx="1.75" className="fill-muted-foreground/30" />
    <rect x="22" y="46" width="132" height="50" rx="10" className="fill-muted" />
    <rect x="28" y="64" width="120" height="11" rx="3" className="ob-sweep fill-amber-400/45" />
    <rect x="32" y="53" width="86" height="4" rx="2" className="fill-muted-foreground/40" />
    <rect x="32" y="66.5" width="104" height="4" rx="2" className="fill-foreground/60" />
    <rect x="32" y="79" width="94" height="4" rx="2" className="fill-muted-foreground/40" />
    <rect x="32" y="87" width="52" height="3" rx="1.5" className="fill-muted-foreground/30" />

    <g className="ob-pop" style={delay(0.7)}>
      <rect x="62" y="104" width="104" height="22" rx="11" className="fill-violet-500" />
      <path d="M75 115h8M79 111v8" className="stroke-white" strokeWidth="1.8" strokeLinecap="round" />
      <text x="90" y="118" fontSize="8.5" fontWeight="600" className="fill-white">
        {tr("onboarding.addToUniflow")}
      </text>
    </g>
    <path d="M118 123v14l3.2-2.8 2.6 5.8 2.4-1.1-2.6-5.7h4.4Z" className="fill-foreground stroke-card" strokeWidth="1" strokeLinejoin="round" />

    <path d="M166 112C190 112 204 100 206 76" className="ob-dash stroke-violet-400" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="3 4" />
    <path d="m201 81 5-6.5 5 6.5" className="stroke-violet-400" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <g className="ob-pop" style={delay(1.1)}>
      <rect x="172" y="22" width="60" height="48" rx="9" className={SURFACE} />
      <rect x="172" y="32" width="3.5" height="28" rx="1.75" className="fill-violet-500" />
      <rect x="183" y="32" width="38" height="5" rx="2.5" className="fill-foreground/70" />
      <rect x="183" y="42" width="26" height="4" rx="2" className="fill-muted-foreground/40" />
      <rect x="183" y="52" width="34" height="9" rx="4.5" className="fill-amber-400/35" />
    </g>
  </Svg>
);

export const ONBOARDING_ART = [BoardArt, QuickAddArt, CalendarArt, AiArt, CaptureArt] as const;
