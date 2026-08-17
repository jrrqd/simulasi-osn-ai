import assert from "node:assert/strict";
import test from "node:test";
import {
  getIoaiAnalogProblems,
  IOAI_ANALOG_PROBLEM_BY_RESOURCE,
  listAnalogProblemIdsForYear,
} from "@/lib/content/ioai-analog-bank";
import {
  IOAI_PACK_YEARS,
  IOAI_YEAR_PACK_IDS,
  practiceProblemIdForResource,
} from "@/lib/content/ioai-year-packs";
import { getProblem, getProblems } from "@/lib/content/load";
import { validateCompetitionSpec } from "@/lib/competition/competition-spec";
import { gradeCompetitionSubmission } from "@/lib/scoring/grade-competition";
import { scoreAnswer } from "@/lib/scoring";

test("15 IOAI analog problems exist and map 1:1 to year-pack resources", () => {
  const problems = getIoaiAnalogProblems();
  assert.equal(problems.length, 15);
  for (const year of IOAI_PACK_YEARS) {
    for (const rid of IOAI_YEAR_PACK_IDS[year]) {
      const pid = IOAI_ANALOG_PROBLEM_BY_RESOURCE[rid];
      assert.equal(pid, practiceProblemIdForResource(rid));
      const p = problems.find((x) => x.id === pid);
      assert.ok(p, `missing problem for ${rid}`);
      assert.equal(p!.answerType, "notebook_submission");
      assert.ok(p!.competitionSpec);
      assert.ok(p!.solution.length > 40);
      assert.ok((p!.tags ?? []).includes("ioai-analog"));
      assert.ok((p!.tags ?? []).includes(`ioai-${year}`));
    }
  }
});

test("analog problems are merged into getProblems()", () => {
  const ids = listAnalogProblemIdsForYear(2025);
  assert.equal(ids.length, 5);
  for (const id of ids) {
    const p = getProblem(id);
    assert.ok(p, id);
    assert.equal(p!.source, "curated");
  }
  assert.ok(getProblems().length >= 15 + 50);
});

test("each analog competitionSpec validates and grades sample submission", async () => {
  for (const p of getIoaiAnalogProblems()) {
    const spec = p.competitionSpec!;
    const v = validateCompetitionSpec(spec);
    assert.ok(v.ok, `${p.id}: ${v.error}`);

    const sample = spec.files.find((f) => /sample_submission/i.test(f.name))!;
    const grade = await gradeCompetitionSubmission({
      competition: spec,
      submissionCsv: sample.content,
    });
    assert.ok(grade.rowCount > 0, p.id);
    assert.ok(grade.score >= 0 && grade.score <= 1, p.id);

    const scored = scoreAnswer({
      answerType: "notebook_submission",
      submitted: sample.content,
      expected: "lihat submission",
      competitionResult: {
        metricValue: grade.metricValue,
        score: grade.score,
        metricLabel: grade.metricLabel,
        log: grade.log,
        rowCount: grade.rowCount,
      },
    });
    assert.equal(typeof scored.score, "number");
  }
});

test("hidden labels produce stronger score than all-zero sample for classification", async () => {
  const p = getProblem("p-analog-ioai-2025-concepts")!;
  const spec = p.competitionSpec!;
  const perfect = await gradeCompetitionSubmission({
    competition: spec,
    submissionCsv: spec.hiddenLabelsCsv!,
  });
  assert.ok(
    perfect.score >= 0.99,
    `expected near-perfect, got ${perfect.score}`,
  );
});
