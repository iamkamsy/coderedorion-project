"use client";

import { useEffect, useRef } from "react";
import type { Rack } from "@/audio/rack";

/** `floating` is the slim bar shown over the expanded camera. */
export function Spectrum({ rack, floating = false }: { rack: Rack | null; floating?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const tokens = getComputedStyle(document.documentElement);
    const accent = tokens.getPropertyValue("--accent").trim();
    const accentSoft = tokens.getPropertyValue("--accent-soft").trim();
    let raf = 0;
    // Smoothed level per point, kept across frames so the curve glides instead of flickering.
    let levels = new Float32Array(0);

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
      // Skip the top half of the bins (mostly empty above ~11 kHz).
      const usable = Math.floor(bins.length / 2);
      const padX = 14;
      const padY = h < 60 ? 7 : 10;
      const points = Math.max(24, Math.floor((w - padX * 2) / 9));
      if (levels.length !== points) levels = new Float32Array(points);

      // Group bins on a log scale so every point covers a slice of the spectrum with no gaps.
      for (let i = 0; i < points; i++) {
        const lo = Math.max(1, Math.floor(Math.pow(usable, i / points)));
        const hi = Math.max(lo + 1, Math.floor(Math.pow(usable, (i + 1) / points)));
        let peak = -Infinity;
        for (let b = lo; b < hi && b < usable; b++) peak = Math.max(peak, bins[b]);
        const mag = Math.min(1, Math.max(0, (peak + 100) / 80));
        // Rise quickly, fall slowly.
        levels[i] += (mag - levels[i]) * (mag > levels[i] ? 0.5 : 0.12);
      }

      const base = h - padY;
      const span = h - padY * 2;
      const xAt = (i: number) => padX + (i / (points - 1)) * (w - padX * 2);
      const yAt = (i: number) => base - levels[i] * span;

      // One continuous curve through the points: quadratic segments between midpoints.
      ctx.beginPath();
      ctx.moveTo(xAt(0), base);
      ctx.lineTo(xAt(0), yAt(0));
      for (let i = 0; i < points - 1; i++) {
        const mx = (xAt(i) + xAt(i + 1)) / 2;
        const my = (yAt(i) + yAt(i + 1)) / 2;
        ctx.quadraticCurveTo(xAt(i), yAt(i), mx, my);
      }
      ctx.lineTo(xAt(points - 1), yAt(points - 1));
      ctx.lineTo(xAt(points - 1), base);
      ctx.closePath();

      const fill = ctx.createLinearGradient(0, padY, 0, base);
      fill.addColorStop(0, accentSoft);
      fill.addColorStop(0.55, accent);
      fill.addColorStop(1, "rgba(250, 45, 72, 0.12)");
      ctx.fillStyle = fill;
      ctx.fill();

      // Bright edge along the top of the shape.
      ctx.beginPath();
      ctx.moveTo(xAt(0), yAt(0));
      for (let i = 0; i < points - 1; i++) {
        ctx.quadraticCurveTo(xAt(i), yAt(i), (xAt(i) + xAt(i + 1)) / 2, (yAt(i) + yAt(i + 1)) / 2);
      }
      ctx.lineTo(xAt(points - 1), yAt(points - 1));
      ctx.strokeStyle = accentSoft;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [rack]);

  return (
    <div className={`relative shrink-0 overflow-hidden glass ${floating ? "h-12 rounded-2xl" : "h-20 rounded-[var(--radius-panel)]"}`}>
      <canvas ref={canvasRef} className="h-full w-full" aria-label="Output spectrum" />
      {!rack && (
        <p className={`absolute inset-0 flex items-center justify-center text-muted ${floating ? "text-xs" : "text-sm"}`}>
          Spectrum appears once audio is started
        </p>
      )}
    </div>
  );
}
