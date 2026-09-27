import assert from "node:assert/strict";
import test from "node:test";
import {
  parseLearningRecordMarker,
  stripLearningRecordMarkers,
} from "@/lib/ai/learning-record-marker";

test("parseLearningRecordMarker reads valid footer", () => {
  const text = `Penjelasan singkat tentang gradient.

Coba: apa beda learning rate tinggi vs rendah?

[[LR|status=understood|topic=gradient-descent|note=Siswa paham arah update bobot]]`;
  const parsed = parseLearningRecordMarker(text);
  assert.ok(parsed);
  assert.equal(parsed.status, "understood");
  assert.equal(parsed.topic, "gradient-descent");
  assert.match(parsed.note, /update bobot/);
});

test("parseLearningRecordMarker rejects bad status or empty note", () => {
  assert.equal(
    parseLearningRecordMarker("hi\n\n[[LR|status=nope|topic=x|note=y]]"),
    null,
  );
  assert.equal(
    parseLearningRecordMarker("hi\n\n[[LR|status=understood|topic=x|note=]]"),
    null,
  );
  assert.equal(parseLearningRecordMarker("no marker here"), null);
});

test("stripLearningRecordMarkers removes markers anywhere", () => {
  const raw = `Jawaban bagus.

[[LR|status=struggling|topic=svm|note=Masih bingung soft margin]]`;
  const cleaned = stripLearningRecordMarkers(raw);
  assert.equal(cleaned.includes("[[LR|"), false);
  assert.match(cleaned, /Jawaban bagus/);
});

test("TEACH_CHAT_SKILL exports a non-empty string", async () => {
  const { TEACH_CHAT_SKILL } = await import("@/lib/ai/skills/teach-chat");
  assert.ok(TEACH_CHAT_SKILL.includes("ZPD") || TEACH_CHAT_SKILL.includes("proksimal"));
  assert.ok(TEACH_CHAT_SKILL.includes("[[LR|"));
});
