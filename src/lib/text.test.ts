import { describe, expect, it } from "vitest";
import { toLastSentence } from "./text";

describe("toLastSentence", () => {
  it("drops a trailing partial sentence", () => {
    expect(toLastSentence("Echoes repeat. Each one passes the filter before feeding")).toBe("Echoes repeat.");
    expect(toLastSentence("Is it loud? It gets louder and")).toBe("Is it loud?");
  });

  it("keeps text that already ends a sentence", () => {
    expect(toLastSentence("Feedback builds up.  ")).toBe("Feedback builds up.");
  });

  it("adds an ellipsis when there is no full sentence to keep", () => {
    expect(toLastSentence("In classic dub every echo loops through")).toBe("In classic dub every echo loops through...");
  });
});
