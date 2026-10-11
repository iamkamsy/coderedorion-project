import Image from "next/image";

/** The Gesture Labs logo: the GL monogram with a sound wave, on its own black tile. Size and corner radius come from className. */
export function Logo({ className = "size-9 rounded-[10px]" }: { className?: string }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden ring-1 ring-black/10 ${className}`}>
      <Image src="/logo.png" alt="" fill sizes="56px" className="object-cover" />
    </span>
  );
}
