// Copies the MediaPipe wasm runtime into public/ so hand tracking works without a CDN.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const src = join(process.cwd(), "node_modules", "@mediapipe", "tasks-vision", "wasm");
const dest = join(process.cwd(), "public", "mediapipe", "wasm");

if (!existsSync(src)) {
  console.error(`MediaPipe wasm folder not found at ${src}`);
  process.exit(1);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("Copied MediaPipe wasm to public/mediapipe/wasm");
