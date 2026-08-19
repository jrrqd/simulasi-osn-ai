import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { assertSafeProviderUrl } from "@/lib/ai/provider";

describe("assertSafeProviderUrl", () => {
  beforeEach(() => {
    delete process.env.ALLOW_LOCAL_AI_PROVIDER;
    delete process.env.AI_PROVIDER_HOST_ALLOWLIST;
  });

  it("accepts known provider hosts over HTTPS", () => {
    assert.equal(
      assertSafeProviderUrl("https://api.minimax.io/v1"),
      "https://api.minimax.io/v1",
    );
    assert.ok(assertSafeProviderUrl("https://api.openai.com/v1"));
    assert.ok(assertSafeProviderUrl("https://openrouter.ai/api/v1"));
  });

  it("rejects unknown hosts (SSRF via DNS rebinding / attacker domains)", () => {
    assert.throws(() => assertSafeProviderUrl("https://evil.example.com/v1"));
    assert.throws(() => assertSafeProviderUrl("https://api.openai.com.evil.io/v1"));
  });

  it("rejects local, private, metadata, and encoded IP destinations", () => {
    const blocked = [
      "http://localhost:11434/v1",
      "http://127.0.0.1/v1",
      "https://10.0.0.5/v1",
      "https://192.168.1.10/v1",
      "https://172.16.0.1/v1",
      "http://169.254.169.254/latest/meta-data",
      "http://0.0.0.0/v1",
      "http://[::1]/v1",
      "http://[fd00::1]/v1",
      "http://[fe80::1]/v1",
      "http://[::ffff:10.0.0.1]/v1",
      "http://2130706433/v1", // decimal-encoded 127.0.0.1
      "http://0x7f000001/v1", // hex-encoded 127.0.0.1
      "https://internal.local/v1",
      "http://100.64.0.1/v1", // CGNAT / Tailscale range
    ];
    for (const url of blocked) {
      assert.throws(() => assertSafeProviderUrl(url), `should block ${url}`);
    }
  });

  it("rejects non-http protocols", () => {
    assert.throws(() => assertSafeProviderUrl("file:///etc/passwd"));
    assert.throws(() => assertSafeProviderUrl("ftp://api.minimax.io/v1"));
  });

  it("requires HTTPS for allowlisted providers", () => {
    assert.throws(() => assertSafeProviderUrl("http://api.minimax.io/v1"));
  });

  it("allows local hosts only with explicit ALLOW_LOCAL_AI_PROVIDER opt-in", () => {
    process.env.ALLOW_LOCAL_AI_PROVIDER = "true";
    assert.ok(assertSafeProviderUrl("http://localhost:11434/v1"));
    assert.ok(assertSafeProviderUrl("http://192.168.1.10:1234/v1"));
    // Unknown public hosts stay blocked even with local opt-in.
    assert.throws(() => assertSafeProviderUrl("https://evil.example.com/v1"));
  });

  it("supports extending the allowlist via env (exact and subdomain)", () => {
    process.env.AI_PROVIDER_HOST_ALLOWLIST =
      "api.my-proxy.example, .corp.example.com";
    assert.ok(assertSafeProviderUrl("https://api.my-proxy.example/v1"));
    assert.ok(assertSafeProviderUrl("https://llm.corp.example.com/v1"));
    assert.ok(assertSafeProviderUrl("https://corp.example.com/v1"));
    assert.throws(() =>
      assertSafeProviderUrl("https://corp.example.com.evil.io/v1"),
    );
  });
});
