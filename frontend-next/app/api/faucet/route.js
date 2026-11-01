import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";
const FAUCET_PRIVATE_KEY = process.env.FAUCET_PRIVATE_KEY || "0xd7e362021fa1878975c5cdd458d493cd2f01dd19554654eeb2a3dca4e428b62c";

export async function POST(request) {
  try {
    const { recipient, amount } = await request.json();

    if (!recipient || !ethers.isAddress(recipient)) {
      return Response.json(
        { error: "Invalid Ethereum recipient address." },
        { status: 400 }
      );
    }

    const c99Amount = parseFloat(amount || "10");
    if (isNaN(c99Amount) || c99Amount <= 0 || c99Amount > 1000) {
      return Response.json(
        { error: "Amount must be between 1 and 1000 C99." },
        { status: 400 }
      );
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(FAUCET_PRIVATE_KEY, provider);

    const weiAmount = ethers.parseEther(c99Amount.toString());

    // Submit raw transaction signed by pre-funded faucet account
    const tx = await wallet.sendTransaction({
      to: recipient,
      value: weiAmount,
      gasLimit: 21000,
      maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
      maxFeePerGas: ethers.parseUnits("3", "gwei"),
    });

    const receipt = await tx.wait(1);

    return Response.json({
      success: true,
      hash: tx.hash,
      blockNumber: receipt.blockNumber,
      amount: c99Amount,
      recipient,
    });
  } catch (err) {
    console.error("Faucet error:", err);
    return Response.json(
      { error: err.message || "Failed to dispense C99 tokens" },
      { status: 500 }
    );
  }
}

