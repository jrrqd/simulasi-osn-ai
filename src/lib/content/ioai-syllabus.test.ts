import assert from "node:assert/strict";
import test from "node:test";
import {
  IOAI_DOMAIN_TOPIC_MAP,
  IOAI_SYLLABUS_ANCHOR_TOPICS,
  IOAI_SYLLABUS_DOMAINS,
  IOAI_SYLLABUS_TOPICS,
  buildIoaiSyllabusStandardsBlock,
  invalidIoaiSyllabusTopics,
  isIoaiSyllabusTopic,
  pickIoaiDomainForSlot,
  pickIoaiSyllabusTopic,
  trackForIoaiTopic,
} from "@/lib/content/ioai-syllabus";
import { TRACKS, type TrackId } from "@/lib/content/types";

test("all IOAI syllabus topics exist in TRACKS", () => {
  assert.deepEqual(invalidIoaiSyllabusTopics(), []);
});

test("anchor topics are in the syllabus pool", () => {
  for (const t of IOAI_SYLLABUS_ANCHOR_TOPICS) {
    assert.ok(isIoaiSyllabusTopic(t), t);
  }
});

test("IOAI domains rotate across 5 slots", () => {
  assert.equal(IOAI_SYLLABUS_DOMAINS.length, 5);
  const domains = [0, 1, 2, 3, 4].map(pickIoaiDomainForSlot);
  assert.deepEqual(domains, [...IOAI_SYLLABUS_DOMAINS]);
});

test("pickIoaiSyllabusTopic returns IOAI topics from available pool", () => {
  const all = (Object.keys(TRACKS) as TrackId[]).flatMap((t) => TRACKS[t].topics);
  for (let i = 0; i < 5; i++) {
    const topic = pickIoaiSyllabusTopic(all, i);
    assert.ok(isIoaiSyllabusTopic(topic), topic);
    const domain = pickIoaiDomainForSlot(i);
    assert.ok(
      IOAI_DOMAIN_TOPIC_MAP[domain].includes(topic) ||
        all.includes(topic),
      `${topic} not in domain ${domain}`,
    );
  }
});

test("trackForIoaiTopic resolves known topics", () => {
  assert.equal(trackForIoaiTopic("python-dasar"), "A");
  assert.equal(trackForIoaiTopic("supervised-learning"), "B");
  assert.equal(trackForIoaiTopic("cnn-arsitektur"), "C");
  assert.equal(trackForIoaiTopic("transformer-dasar"), "D");
});

test("standards block mentions IOAI pillars", () => {
  const block = buildIoaiSyllabusStandardsBlock();
  assert.ok(block.includes("IOAI"));
  assert.ok(block.includes("python"));
  assert.ok(IOAI_SYLLABUS_TOPICS.length >= 10);
});
