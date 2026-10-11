import Link from "next/link";
import { PinchGlyph } from "./PinchGlyph";

/** The app's home link: the Gesture Rack mark plus a Home label, the same on every page. */
export function HomeButton({ label = true }: { label?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Home"
      title="Home: the full studio"
      className="press group flex items-center gap-2 rounded-xl py-0.5 pr-2.5 pl-0.5 hover:bg-black/[0.05]"
    >
      <span className="flex size-9 items-center justify-center rounded-[10px] bg-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]">
        <PinchGlyph />
      </span>
      {label && (
        <span className="flex items-center gap-1.5 text-[13px] font-semibold">
          <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M3.5 9 10 3.5 16.5 9v7a1 1 0 0 1-1 1h-3.5v-4.5h-4V17H4.5a1 1 0 0 1-1-1Z" strokeLinejoin="round" />
          </svg>
          Home
        </span>
      )}
    </Link>
  );
}
