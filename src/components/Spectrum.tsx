"use client";

import { useEffect, useRef } from "react";
import type { Rack } from "@/audio/rack";

export function Spectrum({ rack }: { rack: Rack | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const { clientWidth: w, clientHeight: h } = canvas;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== w * dpr) canvas.width = w * dpr;
      if (canvas.height !== h * dpr) canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!rack) return;

      const bins = rack.getSpectrum();
      // Skip the top half of the bins (mostly empty above ~11 kHz) and use a log-ish x axis.
      const usable = Math.floor(bins.length / 2);
      const barW = w / usable;
      ctx.fillStyle = "#5BC0BE";
      for (let i = 1; i < usable; i++) {
        const db = bins[i];
        const mag = Math.min(1, Math.max(0, (db + 100) / 80));
        const x = (Math.log(i) / Math.log(usable)) * w;
        ctx.fillRect(x, h - mag * h, Math.max(1, barW * 1.5), mag * h);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [rack]);

  return (
    <div className="relative h-20 overflow-hidden rounded-[var(--radius-panel)] border border-border bg-panel">
      <canvas ref={canvasRef} className="h-full w-full" aria-label="Output spectrum" />
      {!rack && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">Spectrum appears once audio is started</p>
      )}
    </div>
  );
}
