// =============================================================
// Chain99 — Next.js API Route: RPC Proxy
// Proxies JSON-RPC calls to the local Geth node to avoid CORS.
// =============================================================

export async function POST(request) {
  try {
    const body = await request.text();

    const gethRes = await fetch("http://127.0.0.1:8545", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    const data = await gethRes.text();

    return new Response(data, {
      status: gethRes.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: `Cannot connect to Geth RPC at 127.0.0.1:8545: ${err.message}`,
        },
        id: null,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
