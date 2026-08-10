import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIoaiReferenceContext,
  filterIoaiResourcesFromList,
  getIoaiResources,
  getIoaiResourcesForPhase,
  getIoaiResourcesForTopic,
  getJsonIoaiFallback,
  MAX_PROMPT_BLOCK_CHARS,
} from "@/lib/content/ioai-resources";

test("JSON fallback catalog has curated IOAI resources", () => {
  const all = getJsonIoaiFallback();
  assert.ok(all.length >= 40, `expected ≥40 resources, got ${all.length}`);
  assert.ok(all.some((r) => r.id === "awesome-ioai-tasks"));
  assert.ok(all.some((r) => r.id === "syllabus-2025"));
});

test("pre-seleksi phase yields empty prompt context and UI list", async () => {
  const ctx = await buildIoaiReferenceContext({
    phase: "pre-seleksi",
    track: "C",
    topic: "cnn-arsitektur",
  });
  assert.equal(ctx, "");

  const list = await getIoaiResourcesForPhase("pre-seleksi", {
    track: "C",
    topic: "cnn-arsitektur",
  });
  assert.equal(list.length, 0);
});

test("filter: final + cnn-arsitektur returns CV-related entries within limit", () => {
  const all = getJsonIoaiFallback();
  const list = filterIoaiResourcesFromList(all, "C", "cnn-arsitektur", {
    limit: 4,
    includeCourses: false,
  });
  assert.ok(list.length > 0);
  assert.ok(list.length <= 4);
  const topicHits = list.filter((r) => r.topics.includes("cnn-arsitektur"));
  assert.ok(topicHits.length > 0, "expected cnn-arsitektur topic matches");
});

test("filter: unknown topic falls back to syllabus/repo entries", () => {
  const all = getJsonIoaiFallback();
  const list = filterIoaiResourcesFromList(all, "B", "topic-yang-tidak-ada", {
    limit: 6,
    includeCourses: false,
  });
  assert.ok(list.length > 0);
  assert.ok(
    list.every(
      (r) => r.category === "syllabus" || r.category === "task_repo",
    ),
  );
});

test("prompt context respects entry and char caps", async () => {
  const ctx = await buildIoaiReferenceContext({
    phase: "final",
    track: "D",
    topic: "transformer-lanjut",
  });
  assert.ok(ctx.includes("Referensi kompetisi IOAI"));
  assert.ok(ctx.includes("JANGAN salin"));
  const bulletCount = (ctx.match(/^- /gm) ?? []).length;
  assert.ok(bulletCount <= 4, `expected ≤4 bullets, got ${bulletCount}`);
  assert.ok(
    ctx.length <= MAX_PROMPT_BLOCK_CHARS,
    `expected ≤${MAX_PROMPT_BLOCK_CHARS} chars, got ${ctx.length}`,
  );
});

test("semifinal phase also injects IOAI context", async () => {
  const ctx = await buildIoaiReferenceContext({
    phase: "semifinal",
    track: "B",
    topic: "ensemble",
  });
  assert.ok(ctx.length > 0);
});

test("getIoaiResources returns visible entries", async () => {
  const all = await getIoaiResources();
  assert.ok(all.length > 0);
  // Hidden rows must not appear in the public list (none hidden in fresh seed).
  assert.ok(all.every((r) => r.id && r.title && r.url));
});

test("getIoaiResourcesForTopic is async and filters", async () => {
  const list = await getIoaiResourcesForTopic("C", "cnn-arsitektur", {
    limit: 3,
    includeCourses: false,
  });
  assert.ok(list.length <= 3);
});
