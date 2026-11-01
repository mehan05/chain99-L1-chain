export async function GET(request) {
  try {
    const _url = new URL(request.url);
    const COSMOS_REST = process.env.COSMOS_REST || "http://127.0.0.1:1317";
    const COMET_RPC = process.env.COMET_RPC || "http://127.0.0.1:26657";

    // 1. Fetch cosmos staking validators
    const [cosmosRes, cometRes] = await Promise.all([
      fetch(`${COSMOS_REST}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED`, {
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : { validators: [] })),
      fetch(`${COMET_RPC}/validators`, {
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : { result: { validators: [] } })),
    ]);

    const cometValidators = cometRes?.result?.validators || [];
    const totalVotingPower = cometValidators.reduce(
      (acc, val) => acc + parseInt(val.voting_power || "0", 10),
      0
    );

    const cometMap = new Map();
    cometValidators.forEach((v) => {
      cometMap.set(v.pub_key?.value, v);
    });

    const validators = (cosmosRes.validators || []).map((val) => {
      const pubkeyVal = val.consensus_pubkey?.key;
      const cometVal = pubkeyVal ? cometMap.get(pubkeyVal) : null;
      const votingPower = cometVal ? parseInt(cometVal.voting_power, 10) : 0;
      const powerPercent =
        totalVotingPower > 0
          ? ((votingPower / totalVotingPower) * 100).toFixed(1)
          : "0.0";

      const bondedTokens = (BigInt(val.tokens || "0") / BigInt(1e18)).toString();

      return {
        operatorAddress: val.operator_address,
        moniker: val.description?.moniker || "Validator",
        website: val.description?.website || "",
        details: val.description?.details || "",
        status: val.status,
        jailed: val.jailed,
        bondedTokensC99: bondedTokens,
        commissionRate: (
          parseFloat(val.commission?.commission_rates?.rate || "0") * 100
        ).toFixed(1),
        maxCommissionRate: (
          parseFloat(val.commission?.commission_rates?.max_rate || "0") * 100
        ).toFixed(1),
        votingPower,
        votingPowerPercent: powerPercent,
        consensusAddress: cometVal?.address || "",
      };
    });

    // Sort by voting power descending
    validators.sort((a, b) => b.votingPower - a.votingPower);

    return Response.json({
      success: true,
      validators,
      totalVotingPower,
      count: validators.length,
      precompileAddress: "0x0000000000000000000000000000000000000800",
    });
  } catch (err) {
    if (err?.digest === "NEXT_PRERENDER_INTERRUPTED") {
      throw err;
    }
    console.error("Validators API error:", err);
    return Response.json(
      { error: err.message || "Failed to load validator status" },
      { status: 500 }
    );
  }
}
