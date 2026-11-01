package main

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewRootCmd(t *testing.T) {
	rootCmd, encodingConfig := NewRootCmd()
	require.NotNil(t, rootCmd)
	require.Equal(t, "chain99d", rootCmd.Use)
	require.NotNil(t, encodingConfig.Codec)
	require.NotNil(t, encodingConfig.InterfaceRegistry)
	require.NotNil(t, encodingConfig.TxConfig)

	// Verify essential subcommands are registered
	subcommands := make(map[string]bool)
	for _, cmd := range rootCmd.Commands() {
		subcommands[cmd.Name()] = true
	}

	require.True(t, subcommands["init"], "init subcommand should be present")
	require.True(t, subcommands["start"], "start subcommand should be present")
	require.True(t, subcommands["keys"], "keys subcommand should be present")
	require.True(t, subcommands["gentx"], "gentx subcommand should be present")
	require.True(t, subcommands["collect-gentxs"], "collect-gentxs subcommand should be present")
	require.True(t, subcommands["add-genesis-account"], "add-genesis-account subcommand should be present")
}

