import { describe, expect, it } from "vitest";
import { normalizeUrl } from "../../extension/url-normalization.js";

describe("shared extension URL normalization", () => {
  it("matches the backend's canonical normalization behavior", () => {
    expect(
      normalizeUrl(
        "HTTPS://Example.COM/article/?utm_source=extension&b=2&a=1#quote",
      ),
    ).toBe("https://example.com/article?a=1&b=2");
  });
});
