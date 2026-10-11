import type { Metadata } from "next";
import { Landscape } from "@/components/Landscape";
import { PinchGlyph } from "@/components/PinchGlyph";

export const metadata: Metadata = {
  title: "Mockup · Gesture Rack",
  description: "Design mockup: light, airy landing-style studio with the effects rack as a dock of live widgets.",
};

// Static design mockup. Nothing here is wired to audio or the camera.

const HAND: [number, number][] = [
  [200, 262], // 0 wrist
  [168, 238],
  [148, 210],
  [138, 180],
  [146, 152], // thumb
  [188, 182],
  [186, 148],
  [178, 126],
  [162, 134], // index (curled into the pinch)
  [210, 176],
  [214, 136],
  [216, 110],
  [217, 86], // middle
  [229, 182],
  [236, 148],
  [240, 125],
  [243, 104], // ring
  [244, 196],
  [256, 171],
  [264, 155],
  [270, 138], // pinky
];

const BONES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];

const FEATURES = [
  "Pinch control",
  "Reverb",
  "Delay",
  "Filter",
  "Gemini mappings",
  "Voice with ElevenLabs",
  "Remembers your taste",
  "Live dashboard",
  "Limiter always on",
  "Video never leaves your device",
];

export default function Mockup() {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#eeeeeb] text-[#111] [letter-spacing:-0.01em]">
      <style>{`
        @keyframes mk-ring { 0%,100% { stroke-dashoffset: 30; } 50% { stroke-dashoffset: 12; } }
        @keyframes mk-bar { 0%,100% { transform: scaleX(.62); } 50% { transform: scaleX(.86); } }
        @keyframes mk-wave { 0%,100% { transform: scaleY(.35); } 50% { transform: scaleY(1); } }
        @keyframes mk-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes mk-glow { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
        .mk-ring { animation: mk-ring 3.2s ease-in-out infinite; }
        .mk-bar { transform-origin: left; animation: mk-bar 3.2s ease-in-out infinite; }
        .mk-wave > span { transform-origin: bottom; animation: mk-wave 1.1s ease-in-out infinite; }
        .mk-float { animation: mk-float 6s ease-in-out infinite; }
        .mk-glow { animation: mk-glow 3.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .mk-ring, .mk-bar, .mk-wave > span, .mk-float, .mk-glow { animation: none; }
        }
      `}</style>

      {/* Floating pill navigation */}
      <header className="sticky top-4 z-20 mx-auto mt-4 flex w-[calc(100%-32px)] max-w-3xl items-center gap-2 rounded-2xl bg-white/80 p-2 pl-2.5 shadow-[0_8px_30px_rgb(0_0_0/0.08)] ring-1 ring-black/5 backdrop-blur-xl">
        <span className="flex size-9 items-center justify-center rounded-[10px] bg-[#111] shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]">
          <PinchGlyph />
        </span>
        <span className="mr-auto text-[15px] font-semibold tracking-tight sm:mr-6">Gesture Rack</span>
        <nav className="mr-auto hidden gap-6 text-sm text-black/60 sm:flex">
          <span>Studio</span>
          <span>Effects</span>
          <span>AI</span>
          <span>Dashboard</span>
        </nav>
        <span className="flex items-center gap-1.5 rounded-xl bg-[#111] px-3.5 py-2 text-[13px] font-semibold text-white">
          <PlayIcon className="size-3" />
          Start audio
        </span>
      </header>

      {/* Hero copy */}
      <section className="mx-auto max-w-3xl px-4 pt-20 text-center sm:pt-24">
        <p className="flex items-center justify-center gap-2 text-[15px] font-medium sm:text-lg">
          <span aria-hidden>✋</span> Shape sound with your hands
        </p>
        <h1 className="mt-4 text-[44px] leading-[0.98] font-bold tracking-[-0.045em] sm:text-7xl">
          Pinch to shape
          <br />
          your sound.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base text-black/60 sm:text-lg">
          Your webcam tracks your hands. Pinch to open the reverb, sweep the filter, and push the delay, live. Tell the AI what you want to
          hear and it maps the controls for you.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <span className="flex items-center gap-2 rounded-2xl bg-[#111] px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_30px_-10px_rgb(0_0_0/0.5)]">
            <PlayIcon className="size-3.5" />
            Start the rack
          </span>
          <p className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-[13px] text-black/45">
            <span>Runs in your browser</span>
            <span>Video never leaves your device</span>
            <span>Headphones recommended</span>
          </p>
        </div>
      </section>

      {/* Scene: misty landscape with the glass studio window floating over it */}
      <section className="relative mt-14 px-4 pb-24 sm:mt-16">
        <Landscape id="mk" className="absolute inset-x-0 top-[-60px] bottom-0" />

        <div className="mk-float relative mx-auto max-w-4xl">
          <div className="relative overflow-hidden rounded-[28px] bg-white/10 shadow-[0_30px_80px_-20px_rgb(40_50_30/0.45)] ring-1 ring-white/60 backdrop-blur-md">
            {/* Window chrome */}
            <div className="flex items-center justify-between px-5 pt-3 text-[11px] font-medium text-black/55">
              <span className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-black/15" />
                <span className="size-2.5 rounded-full bg-black/15" />
                <span className="size-2.5 rounded-full bg-black/15" />
              </span>
              <span className="rounded-full bg-black/80 px-4 py-1 text-white">Camera · Tracking</span>
              <span>Right pinch 0.81</span>
            </div>

            {/* Camera stage */}
            <div className="relative mx-auto aspect-[16/8.5] w-full">
              <svg viewBox="0 0 400 300" className="absolute inset-0 m-auto h-full w-full" aria-hidden>
                <defs>
                  <filter id="mk-pinch-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" />
                  </filter>
                </defs>
                <g stroke="white" strokeWidth="2.4" strokeLinecap="round" opacity="0.9">
                  {BONES.map(([a, b]) => (
                    <line key={`${a}-${b}`} x1={HAND[a][0]} y1={HAND[a][1]} x2={HAND[b][0]} y2={HAND[b][1]} />
                  ))}
                </g>
                {HAND.map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r={i === 4 || i === 8 ? 4.5 : 3} fill="white" />
                ))}
                <line
                  x1={HAND[4][0]}
                  y1={HAND[4][1]}
                  x2={HAND[8][0]}
                  y2={HAND[8][1]}
                  stroke="#fa2d48"
                  strokeWidth="8"
                  filter="url(#mk-pinch-glow)"
                  className="mk-glow"
                />
                <line
                  x1={HAND[4][0]}
                  y1={HAND[4][1]}
                  x2={HAND[8][0]}
                  y2={HAND[8][1]}
                  stroke="#fa2d48"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>

              {/* Chips next to the hand */}
              <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5 sm:top-[22%] sm:left-[calc(50%-120px)] sm:-translate-x-full sm:items-end">
                <span className="rounded-full bg-black/75 px-3 py-1 font-mono text-[11px] text-white backdrop-blur">Reverb Mix 64%</span>
                <span className="rounded-full bg-black/75 px-3 py-1 font-mono text-[11px] text-white backdrop-blur">
                  Delay Feedback 0.42
                </span>
              </div>
            </div>

            {/* The dock: effects rack as live widgets */}
            <div className="relative px-3 pb-4 sm:px-6 sm:pb-6">
              <div className="flex gap-2 overflow-x-auto rounded-[22px] bg-[#0c0c0d] p-2 text-white shadow-[0_20px_40px_-12px_rgb(0_0_0/0.6)] ring-1 ring-white/10 [scrollbar-width:none]">
                <Tile className="w-[92px] items-center justify-center">
                  <Ring value={81} />
                  <span className="text-[10px] text-white/50">Right pinch</span>
                </Tile>

                <ParamTile label="Reverb" param="Mix" value="64%" live />
                <ParamTile label="Delay" param="Feedback" value="0.42" live />
                <ParamTile label="Filter" param="Cutoff" value="6.1k" live tint="left" />

                <Tile className="w-[136px] justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] text-white/50">
                    <Sparkle /> Gemini
                  </span>
                  <span className="text-[13px] leading-tight font-semibold">Make it dreamier</span>
                  <span className="w-fit rounded-full bg-[#fa2d48] px-2 py-0.5 text-[10px] font-semibold">Mapped</span>
                </Tile>

                <Tile className="min-w-[260px] flex-1 flex-row items-center gap-3">
                  <span className="mk-wave flex size-12 shrink-0 items-end justify-center gap-[3px] rounded-xl bg-gradient-to-br from-[#fa2d48] to-[#af52de] p-2.5">
                    {[0, 0.15, 0.3, 0.45, 0.6].map((d) => (
                      <span key={d} className="h-full w-1 rounded-full bg-white/90" style={{ animationDelay: `${d}s` }} />
                    ))}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="truncate text-[13px] font-semibold">Test loop</span>
                    <span className="truncate text-[11px] text-white/50">Gesture Rack · Limiter on</span>
                    <span className="h-1 w-full overflow-hidden rounded-full bg-white/15">
                      <span className="mk-bar block h-full w-full rounded-full bg-white" />
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="flex size-7 items-center justify-center rounded-full bg-white/10 text-[10px]">⏮</span>
                    <span className="flex size-9 items-center justify-center rounded-full bg-white text-black">
                      <PlayIcon className="ml-0.5 size-3.5" />
                    </span>
                    <span className="flex size-7 items-center justify-center rounded-full bg-white/10 text-[10px]">⏭</span>
                  </span>
                </Tile>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature chips */}
      <section className="mx-auto max-w-3xl px-4 pb-28 text-center">
        <h2 className="text-3xl font-bold tracking-[-0.035em] sm:text-5xl">Everything, one pinch away</h2>
        <p className="mx-auto mt-4 max-w-lg text-black/55">Effects, AI mappings and live data in one studio that answers to your hands.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {FEATURES.map((f) => (
            <span
              key={f}
              className="rounded-full bg-white px-4 py-2 text-sm font-medium shadow-[0_1px_2px_rgb(0_0_0/0.06)] ring-1 ring-black/5"
            >
              {f}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

function Tile({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex h-[84px] shrink-0 flex-col gap-1 rounded-2xl bg-[#1c1c1e] px-3 py-2.5 ring-1 ring-white/5 ${className}`}>
      {children}
    </div>
  );
}

function ParamTile({
  label,
  param,
  value,
  live,
  tint = "right",
}: {
  label: string;
  param: string;
  value: string;
  live?: boolean;
  tint?: "left" | "right";
}) {
  return (
    <Tile className="w-[96px] justify-between">
      <span className="flex items-center justify-between text-[10px] text-white/50">
        {label}
        {live && (
          <span
            className="size-1.5 rounded-full bg-[#fa2d48] shadow-[0_0_6px_#fa2d48]"
            title={`${tint === "left" ? "Left" : "Right"} pinch`}
          />
        )}
      </span>
      <span className="text-[22px] leading-none font-semibold tracking-tight">{value}</span>
      <span className="flex flex-col gap-1">
        <span className="text-[10px] text-white/50">{param}</span>
        <span className="h-1 overflow-hidden rounded-full bg-white/15">
          <span className="mk-bar block h-full w-full rounded-full bg-gradient-to-r from-[#fa2d48] to-[#fb5c74]" />
        </span>
      </span>
    </Tile>
  );
}

function Ring({ value }: { value: number }) {
  const c = 2 * Math.PI * 18;
  return (
    <span className="relative flex size-11 items-center justify-center">
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="22" cy="22" r="18" fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke="#fa2d48"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          className="mk-ring"
        />
      </svg>
      <span className="text-[13px] font-semibold">{value}</span>
    </span>
  );
}

function PlayIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="currentColor" aria-hidden>
      <path d="M6 3.8v12.4a.8.8 0 0 0 1.2.7l10-6.2a.8.8 0 0 0 0-1.4l-10-6.2a.8.8 0 0 0-1.2.7Z" />
    </svg>
  );
}

function Sparkle() {
  return (
    <svg viewBox="0 0 20 20" className="size-3" fill="currentColor" aria-hidden>
      <path d="M10 2 11.8 8.2 18 10l-6.2 1.8L10 18l-1.8-6.2L2 10l6.2-1.8L10 2Z" />
    </svg>
  );
}
