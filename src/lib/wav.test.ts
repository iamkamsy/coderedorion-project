import { describe, expect, it } from "vitest";
import { encodeWav, toBase64 } from "./wav";

describe("encodeWav", () => {
  it("writes a valid 16-bit mono PCM header", () => {
    const wav = new DataView(encodeWav(new Float32Array(100), 16000));
    const tag = (o: number) => String.fromCharCode(...new Uint8Array(wav.buffer, o, 4));
    expect(tag(0)).toBe("RIFF");
    expect(tag(8)).toBe("WAVE");
    expect(tag(36)).toBe("data");
    expect(wav.getUint16(22, true)).toBe(1);
    expect(wav.getUint32(24, true)).toBe(16000);
    expect(wav.getUint16(34, true)).toBe(16);
    expect(wav.getUint32(40, true)).toBe(200);
    expect(wav.byteLength).toBe(244);
  });

  it("clamps and scales samples", () => {
    const wav = new DataView(encodeWav(Float32Array.from([1, -1, 2, 0]), 8000));
    expect(wav.getInt16(44, true)).toBe(32767);
    expect(wav.getInt16(46, true)).toBe(-32768);
    expect(wav.getInt16(48, true)).toBe(32767);
    expect(wav.getInt16(50, true)).toBe(0);
  });
});

describe("toBase64", () => {
  it("round-trips bytes", () => {
    const bytes = Uint8Array.from([0, 1, 2, 250, 255]);
    expect(Buffer.from(toBase64(bytes.buffer), "base64")).toEqual(Buffer.from(bytes));
  });
});
