import { describe, expect, it, vi, afterEach } from "vitest";
import { __testing } from "./web-search.js";

const {
  inferPerplexityBaseUrlFromApiKey,
  resolvePerplexityBaseUrl,
  normalizeFreshness,
  resolveTavilyApiKey,
  resolveSearchProvider,
} = __testing;

describe("web_search perplexity baseUrl defaults", () => {
  it("detects a Perplexity key prefix", () => {
    expect(inferPerplexityBaseUrlFromApiKey("pplx-123")).toBe("direct");
  });

  it("detects an OpenRouter key prefix", () => {
    expect(inferPerplexityBaseUrlFromApiKey("sk-or-v1-123")).toBe("openrouter");
  });

  it("returns undefined for unknown key formats", () => {
    expect(inferPerplexityBaseUrlFromApiKey("unknown-key")).toBeUndefined();
  });

  it("prefers explicit baseUrl over key-based defaults", () => {
    expect(resolvePerplexityBaseUrl({ baseUrl: "https://example.com" }, "config", "pplx-123")).toBe(
      "https://example.com",
    );
  });

  it("defaults to direct when using PERPLEXITY_API_KEY", () => {
    expect(resolvePerplexityBaseUrl(undefined, "perplexity_env")).toBe("https://api.perplexity.ai");
  });

  it("defaults to OpenRouter when using OPENROUTER_API_KEY", () => {
    expect(resolvePerplexityBaseUrl(undefined, "openrouter_env")).toBe(
      "https://openrouter.ai/api/v1",
    );
  });

  it("defaults to direct when config key looks like Perplexity", () => {
    expect(resolvePerplexityBaseUrl(undefined, "config", "pplx-123")).toBe(
      "https://api.perplexity.ai",
    );
  });

  it("defaults to OpenRouter when config key looks like OpenRouter", () => {
    expect(resolvePerplexityBaseUrl(undefined, "config", "sk-or-v1-123")).toBe(
      "https://openrouter.ai/api/v1",
    );
  });

  it("defaults to OpenRouter for unknown config key formats", () => {
    expect(resolvePerplexityBaseUrl(undefined, "config", "weird-key")).toBe(
      "https://openrouter.ai/api/v1",
    );
  });
});

describe("web_search freshness normalization", () => {
  it("accepts Brave shortcut values", () => {
    expect(normalizeFreshness("pd")).toBe("pd");
    expect(normalizeFreshness("PW")).toBe("pw");
  });

  it("accepts valid date ranges", () => {
    expect(normalizeFreshness("2024-01-01to2024-01-31")).toBe("2024-01-01to2024-01-31");
  });

  it("rejects invalid date ranges", () => {
    expect(normalizeFreshness("2024-13-01to2024-01-31")).toBeUndefined();
    expect(normalizeFreshness("2024-02-30to2024-03-01")).toBeUndefined();
    expect(normalizeFreshness("2024-03-10to2024-03-01")).toBeUndefined();
  });
});

describe("web_search provider resolution", () => {
  it("defaults to brave", () => {
    expect(resolveSearchProvider(undefined)).toBe("brave");
    expect(resolveSearchProvider({})).toBe("brave");
  });

  it("resolves tavily", () => {
    expect(resolveSearchProvider({ provider: "tavily" })).toBe("tavily");
  });

  it("resolves perplexity", () => {
    expect(resolveSearchProvider({ provider: "perplexity" })).toBe("perplexity");
  });

  it("resolves brave explicit", () => {
    expect(resolveSearchProvider({ provider: "brave" })).toBe("brave");
  });

  it("falls back to brave for unknown provider", () => {
    // @ts-expect-error testing invalid input
    expect(resolveSearchProvider({ provider: "unknown" })).toBe("brave");
  });

  it("reads from WEB_SEARCH_PROVIDER env var", () => {
    process.env.WEB_SEARCH_PROVIDER = "tavily";
    expect(resolveSearchProvider(undefined)).toBe("tavily");
    delete process.env.WEB_SEARCH_PROVIDER;
  });

  it("prefers config over env var for provider", () => {
    process.env.WEB_SEARCH_PROVIDER = "tavily";
    expect(resolveSearchProvider({ provider: "brave" })).toBe("brave");
    delete process.env.WEB_SEARCH_PROVIDER;
  });
});

describe("web_search tavily api key", () => {
  afterEach(() => {
    delete process.env.TAVILY_API_KEY;
  });

  it("reads from config", () => {
    expect(resolveTavilyApiKey({ tavily: { apiKey: "test-key" } })).toBe("test-key");
  });

  it("reads from env", () => {
    process.env.TAVILY_API_KEY = "env-key";
    expect(resolveTavilyApiKey(undefined)).toBe("env-key");
  });

  it("prefers config over env", () => {
    process.env.TAVILY_API_KEY = "env-key";
    expect(resolveTavilyApiKey({ tavily: { apiKey: "config-key" } })).toBe("config-key");
  });

  it("returns undefined if missing", () => {
    expect(resolveTavilyApiKey(undefined)).toBeUndefined();
  });
});
