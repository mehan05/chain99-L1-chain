package main

import (
	"os"

	svrcmd "github.com/cosmos/cosmos-sdk/server/cmd"
	sdk "github.com/cosmos/cosmos-sdk/types"

	cmdcfg "github.com/chain99/chain99-L1-chain/cmd/chain99d/config"
)

func main() {
	setupSDKConfig()

	rootCmd, _ := NewRootCmd()

	if err := svrcmd.Execute(rootCmd, EnvPrefix, cmdcfg.DefaultNodeHome); err != nil {
		os.Exit(1)
	}
}

func setupSDKConfig() {
	config := sdk.GetConfig()
	cmdcfg.SetBech32Prefixes(config)
	cmdcfg.SetBip44CoinType(config)
	cmdcfg.RegisterDenoms()
	config.Seal()
}
