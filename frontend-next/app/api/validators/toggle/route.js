import { getNodeStatuses, stopNode, startNode, toggleNode } from "@/app/lib/node-manager";
import { stressEngine } from "@/app/lib/stress-engine";

export async function GET() {
  try {
    const nodes = await getNodeStatuses();
    return Response.json({ success: true, nodes });
  } catch (err) {
    return Response.json(
      { success: false, error: err.message || "Failed to query validator node statuses" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { nodeId, action = "toggle" } = body;

    let result;
    if (action === "stop") {
      result = await stopNode(nodeId);
      stressEngine.triggerIncident(
        `Validator ${result.name || nodeId} Offline (BFT Test)`,
        `Node process stopped. Testing BFT consensus resilience while remaining validators process transactions.`
      );
    } else if (action === "start") {
      result = await startNode(nodeId);
      stressEngine.triggerIncident(
        `Validator ${result.name || nodeId} Restored`,
        `Node process restarted. Rejoining CometBFT P2P consensus mesh.`
      );
    } else {
      result = await toggleNode(nodeId);
      if (result.action === "stop") {
        stressEngine.triggerIncident(
          `Validator ${result.name || nodeId} Offline (BFT Test)`,
          `Node process stopped. Testing BFT consensus resilience while remaining validators process transactions.`
        );
      } else {
        stressEngine.triggerIncident(
          `Validator ${result.name || nodeId} Restored`,
          `Node process restarted. Rejoining CometBFT P2P consensus mesh.`
        );
      }
    }

    // Refresh node statuses
    const updatedNodes = await getNodeStatuses();

    return Response.json({
      success: true,
      ...result,
      nodes: updatedNodes,
    });
  } catch (err) {
    console.error("Validator toggle error:", err);
    return Response.json(
      { success: false, error: err.message || "Failed to toggle validator node" },
      { status: 500 }
    );
  }
}

