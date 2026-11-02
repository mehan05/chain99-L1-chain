import { stressEngine } from "@/app/lib/stress-engine";

export async function GET(request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send immediate initial frame
      try {
        const initial = stressEngine.getSnapshot();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initial)}\n\n`));
      } catch (e) {
        console.warn("SSE initial send failed:", e.message);
      }

      // Stream frames at 600ms cadence
      const interval = setInterval(() => {
        try {
          const snapshot = stressEngine.getSnapshot();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`));
        } catch {
          clearInterval(interval);
        }
      }, 600);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
