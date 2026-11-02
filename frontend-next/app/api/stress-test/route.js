import { stressEngine } from "@/app/lib/stress-engine";

export async function GET() {
  try {
    const snapshot = stressEngine.getSnapshot();
    return Response.json({ success: true, ...snapshot });
  } catch (err) {
    return Response.json(
      { success: false, error: err.message || "Failed to get stress engine snapshot" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const action = body.action;

    switch (action) {
      case "start": {
        const result = await stressEngine.start(body.config || {});
        return Response.json({ success: true, message: "Stress test started", ...result });
      }
      case "pause": {
        stressEngine.pause();
        return Response.json({ success: true, message: "Stress test paused", status: stressEngine.status });
      }
      case "resume": {
        stressEngine.resume();
        return Response.json({ success: true, message: "Stress test resumed", status: stressEngine.status });
      }
      case "stop": {
        stressEngine.stop();
        return Response.json({ success: true, message: "Stress test stopping", status: stressEngine.status });
      }
      case "reset": {
        stressEngine.reset();
        return Response.json({ success: true, message: "Stress test reset", status: stressEngine.status });
      }
      case "report": {
        const report = stressEngine.generateFinalReport();
        return Response.json({ success: true, report });
      }
      default:
        return Response.json(
          { success: false, error: `Invalid action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("Stress engine API error:", err);
    return Response.json(
      { success: false, error: err.message || "Stress engine operation failed" },
      { status: 500 }
    );
  }
}
