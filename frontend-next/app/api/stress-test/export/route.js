import { stressEngine } from "@/app/lib/stress-engine";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") === "csv" ? "csv" : "json";

    const payload = stressEngine.exportData(format);
    const filename = `chain99-stress-benchmark-${Date.now()}.${format}`;

    if (format === "csv") {
      return new Response(payload, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return new Response(payload, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return Response.json(
      { success: false, error: err.message || "Failed to export report" },
      { status: 500 }
    );
  }
}
