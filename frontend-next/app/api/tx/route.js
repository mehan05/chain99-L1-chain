import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";
const DEPLOYER_PRIVATE_KEY = process.env.FAUCET_PRIVATE_KEY || "0xd7e362021fa1878975c5cdd458d493cd2f01dd19554654eeb2a3dca4e428b62c";

export async function POST(request) {
  try {
    const { to, data, value, gasLimit } = await request.json();

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);

    const txPayload = {
      maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
      maxFeePerGas: ethers.parseUnits("3", "gwei"),
    };

    if (to) txPayload.to = to;
    if (data) txPayload.data = data;
    if (value) txPayload.value = BigInt(value);
    if (gasLimit) txPayload.gasLimit = BigInt(gasLimit);

    const tx = await wallet.sendTransaction(txPayload);
    const receipt = await tx.wait(1);

    return Response.json({
      success: true,
      hash: tx.hash,
      blockNumber: receipt.blockNumber,
      contractAddress: receipt.contractAddress || null,
      gasUsed: receipt.gasUsed.toString(),
    });
  } catch (err) {
    console.error("Tx dispatch error:", err);
    return Response.json(
      { error: err.message || "Transaction failed" },
      { status: 500 }
    );
  }
}

