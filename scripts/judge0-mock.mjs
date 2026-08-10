/**
 * Tiny Judge0-compatible mock used to verify the hidden-test network
 * boundary end-to-end. Implements only the batch submission endpoints
 * that gradeCodeWithJudge0 calls.
 */
import { createServer } from "node:http";

const port = Number(process.env.JUDGE0_MOCK_PORT ?? 2358);
const failures = new Map();
let expectations = { validOutput: "42\n" };
let lastBatchUrl = "";

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "POST" && url.pathname === "/__test/failures") {
    const parsed = JSON.parse((await readBody(req)) || "{}");
    failures.set(String(parsed.submissionId), { stdout: parsed.stdout });
    res.statusCode = 201;
    res.end("{}");
    return;
  }
  if (req.method === "POST" && url.pathname === "/__test/expectations") {
    expectations = JSON.parse((await readBody(req)) || "{}");
    res.statusCode = 201;
    res.end("{}");
    return;
  }
  if (req.method === "POST" && url.pathname === "/__test/reset") {
    failures.clear();
    expectations = { validOutput: "42\n" };
    res.statusCode = 201;
    res.end("{}");
    return;
  }
  if (req.method === "POST" && url.pathname === "/submissions/batch") {
    lastBatchUrl = String(req.url);
    const payload = JSON.parse((await readBody(req)) || "{}");
    const tokens = payload.submissions.map((_, i) => {
      const failure = failures.get(String(i));
      return `t${i + 1}`;
    });
    res.statusCode = 201;
    res.end(JSON.stringify(tokens.map((t) => ({ token: t }))));
    return;
  }
  if (req.method === "GET" && url.pathname === "/submissions/batch") {
    const tokens = (url.searchParams.get("tokens") ?? "").split(",").filter(Boolean);
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        submissions: tokens.map((_t, i) => {
          const failure = failures.get(String(i));
          const stdout = failure?.stdout ?? expectations.validOutput;
          return { stdout, status: { id: 3, description: "Accepted" } };
        }),
      }),
    );
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: "not found", path: url.pathname, lastBatchUrl }));
});

server.listen(port, () => {
  console.log(`judge0-mock listening on http://127.0.0.1:${port}`);
});
