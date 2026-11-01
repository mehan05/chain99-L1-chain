package config_test

import (
	"testing"

	sdk "github.com/cosmos/cosmos-sdk/types"
	"github.com/stretchr/testify/require"

	cmdcfg "github.com/chain99/chain99-L1-chain/cmd/chain99d/config"
)

func TestConfigPrefixesAndDenoms(t *testing.T) {
	require.Equal(t, "c99", cmdcfg.Bech32Prefix)
	require.Equal(t, "c99", cmdcfg.Bech32PrefixAccAddr)
	require.Equal(t, "c99valoper", cmdcfg.Bech32PrefixValAddr)
	require.Equal(t, "c99valcons", cmdcfg.Bech32PrefixConsAddr)
	require.Equal(t, "ac99", cmdcfg.BaseDenom)
	require.Equal(t, "c99", cmdcfg.DisplayDenom)

	config := sdk.GetConfig()
	cmdcfg.SetBech32Prefixes(config)
	cmdcfg.SetBip44CoinType(config)

	require.Equal(t, cmdcfg.Bech32PrefixAccAddr, config.GetBech32AccountAddrPrefix())
	require.Equal(t, cmdcfg.Bech32PrefixValAddr, config.GetBech32ValidatorAddrPrefix())
	require.Equal(t, cmdcfg.Bech32PrefixConsAddr, config.GetBech32ConsensusAddrPrefix())
	require.Equal(t, uint32(60), config.GetCoinType())
}

