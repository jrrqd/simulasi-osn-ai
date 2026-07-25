/** NDJSON progress events for AI quiz / problem generation. */

export type GenerationProgressEvent =
  | {
      type: "status";
      message: string;
      index?: number;
      total?: number;
    }
  | {
      type: "question_start";
      index: number;
      total: number;
      track: string;
      topic: string;
      topicLabel: string;
      difficulty: number;
      attempt?: number;
    }
  | {
      type: "attempt";
      index: number;
      attempt: number;
      maxAttempts: number;
      phase: "generating" | "repairing" | "validating";
    }
  | {
      type: "thinking";
      index: number;
      attempt: number;
      /** Accumulated reasoning text for the current attempt. */
      text: string;
    }
  | {
      type: "question_done";
      index: number;
      total: number;
      title: string;
      topic: string;
      topicLabel: string;
    }
  | {
      type: "slot_done";
      phase: "slot";
      planId: string;
      index: number;
      problemId: string;
      title: string;
      topic: string;
      topicLabel: string;
      difficulty: number;
      reused?: boolean;
    }
  | {
      type: "error";
      error: string;
      index?: number;
    };

export type GenerationProgressHandler = (
  event: GenerationProgressEvent,
) => void | Promise<void>;

export function createNdjsonStreamResponse(
  run: (send: GenerationProgressHandler) => Promise<void>,
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: GenerationProgressHandler = (event) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        await run(send);
      } catch (e) {
        await send({
          type: "error",
          error:
            e instanceof Error ? e.message : "Gagal menghasilkan simulasi AI",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
