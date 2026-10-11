import { describe, expect, it } from "vitest";
import { placeCard, visibleRect } from "./placement";

const viewport = { width: 1000, height: 800 };
const card = { width: 320, height: 160 };

describe("visibleRect", () => {
  it("clips the target to its scroll container and the viewport", () => {
    const r = visibleRect({ top: 450, left: 100, right: 300, bottom: 550 }, [{ top: 0, left: 0, right: 1000, bottom: 500 }], viewport);
    expect(r).toEqual({ top: 450, left: 100, right: 300, bottom: 500 });
  });

  it("works with DOMRect-like objects whose fields live on the prototype", () => {
    class ProtoRect {
      get top() {
        return 10;
      }
      get left() {
        return 20;
      }
      get right() {
        return 120;
      }
      get bottom() {
        return 60;
      }
    }
    expect(visibleRect(new ProtoRect(), [], viewport)).toEqual({ top: 10, left: 20, right: 120, bottom: 60 });
  });

  it("is null once the target has scrolled out of its container", () => {
    expect(
      visibleRect({ top: 600, left: 100, right: 300, bottom: 650 }, [{ top: 0, left: 0, right: 1000, bottom: 500 }], viewport),
    ).toBeNull();
    expect(visibleRect({ top: -80, left: 0, right: 100, bottom: -10 }, [], viewport)).toBeNull();
  });
});

describe("placeCard", () => {
  it("goes below when there is room and centers on the target", () => {
    expect(placeCard({ top: 100, left: 400, right: 600, bottom: 140 }, card, viewport, "below", 12)).toEqual({
      top: 152,
      left: 340,
      side: "below",
    });
  });

  it("flips above only when below no longer fits", () => {
    const nearBottom = { top: 700, left: 400, right: 600, bottom: 740 };
    expect(placeCard(nearBottom, card, viewport, "below", 12).side).toBe("above");
  });

  it("keeps its current side while it still fits, so scrolling does not make it flip", () => {
    const middle = { top: 300, left: 400, right: 600, bottom: 340 };
    expect(placeCard(middle, card, viewport, "above", 12).side).toBe("above");
    expect(placeCard(middle, card, viewport, "below", 12).side).toBe("below");
  });

  it("stays inside the viewport near the edges", () => {
    const p = placeCard({ top: 100, left: 0, right: 40, bottom: 140 }, card, viewport, "below", 12);
    expect(p.left).toBe(12);
  });
});
