import { getNodeMempoolTxs } from "@/app/lib/node-manager";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get("nodeId") || "node1";
    const limit = parseInt(searchParams.get("limit") || "30", 10);

    const mempoolData = await getNodeMempoolTxs(nodeId, limit);
    return Response.json({ success: true, ...mempoolData });
  } catch (err) {
    return Response.json(
      { success: false, error: err.message || "Failed to fetch validator mempool" },
      { status: 500 }
    );
  }
}

