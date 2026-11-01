// Copyright (c) Chain99 Foundation
// SPDX-License-Identifier: MIT

package main

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/spf13/cast"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"cosmossdk.io/log"
	"cosmossdk.io/store"
	"cosmossdk.io/store/snapshots"
	snapshottypes "cosmossdk.io/store/snapshots/types"
	storetypes "cosmossdk.io/store/types"
	confixcmd "cosmossdk.io/tools/confix/cmd"

	cmtcfg "github.com/cometbft/cometbft/config"
	cmtcli "github.com/cometbft/cometbft/libs/cli"
	dbm "github.com/cosmos/cosmos-db"

	"github.com/cosmos/cosmos-sdk/baseapp"
	"github.com/cosmos/cosmos-sdk/client"
	clientcfg "github.com/cosmos/cosmos-sdk/client/config"
	"github.com/cosmos/cosmos-sdk/client/flags"
	"github.com/cosmos/cosmos-sdk/client/pruning"
	"github.com/cosmos/cosmos-sdk/client/rpc"
	"github.com/cosmos/cosmos-sdk/client/snapshot"
	sdkserver "github.com/cosmos/cosmos-sdk/server"
	servertypes "github.com/cosmos/cosmos-sdk/server/types"
	sdk "github.com/cosmos/cosmos-sdk/types"
	sdktestutil "github.com/cosmos/cosmos-sdk/types/module/testutil"
	"github.com/cosmos/cosmos-sdk/types/tx/signing"
	authcmd "github.com/cosmos/cosmos-sdk/x/auth/client/cli"
	"github.com/cosmos/cosmos-sdk/x/auth/tx"
	txmodule "github.com/cosmos/cosmos-sdk/x/auth/tx/config"
	authtypes "github.com/cosmos/cosmos-sdk/x/auth/types"
	banktypes "github.com/cosmos/cosmos-sdk/x/bank/types"
	"github.com/cosmos/cosmos-sdk/x/crisis"
	genutilcli "github.com/cosmos/cosmos-sdk/x/genutil/client/cli"
	genutiltypes "github.com/cosmos/cosmos-sdk/x/genutil/types"

	rosettaCmd "github.com/cosmos/rosetta/cmd"

	"github.com/evmos/evmos/v20/app"
	evmosclient "github.com/evmos/evmos/v20/client"
	"github.com/evmos/evmos/v20/client/block"
	evmosdebug "github.com/evmos/evmos/v20/client/debug"
	evmoskr "github.com/evmos/evmos/v20/crypto/keyring"
	evmosserver "github.com/evmos/evmos/v20/server"
	servercfg "github.com/evmos/evmos/v20/server/config"
	srvflags "github.com/evmos/evmos/v20/server/flags"

	cmdcfg "github.com/chain99/chain99-L1-chain/cmd/chain99d/config"
)

const EnvPrefix = "CHAIN99"

type emptyAppOptions struct{}

func (ao emptyAppOptions) Get(_ string) interface{} { return nil }

// NewRootCmd creates a new root command for chain99d.
func NewRootCmd() (*cobra.Command, sdktestutil.TestEncodingConfig) {
	tempApp := app.NewEvmos(
		log.NewNopLogger(),
		dbm.NewMemDB(),
		nil, true, nil,
		tempDir(cmdcfg.DefaultNodeHome),
		0,
		emptyAppOptions{},
	)
	encodingConfig := sdktestutil.TestEncodingConfig{
		InterfaceRegistry: tempApp.InterfaceRegistry(),
		Codec:             tempApp.AppCodec(),
		TxConfig:          tempApp.GetTxConfig(),
		Amino:             tempApp.LegacyAmino(),
	}
	initClientCtx := client.Context{}.
		WithCodec(encodingConfig.Codec).
		WithInterfaceRegistry(encodingConfig.InterfaceRegistry).
		WithTxConfig(encodingConfig.TxConfig).
		WithLegacyAmino(encodingConfig.Amino).
		WithInput(os.Stdin).
		WithAccountRetriever(authtypes.AccountRetriever{}).
		WithBroadcastMode(flags.FlagBroadcastMode).
		WithHomeDir(cmdcfg.DefaultNodeHome).
		WithKeyringOptions(evmoskr.Option()).
		WithViper(EnvPrefix).
		WithLedgerHasProtobuf(true)

	rootCmd := &cobra.Command{
		Use:   "chain99d",
		Short: "Chain99 L1 Daemon (Proof-of-Stake with CometBFT & Cosmos EVM)",
		PersistentPreRunE: func(cmd *cobra.Command, _ []string) error {
			cmd.SetOut(cmd.OutOrStdout())
			cmd.SetErr(cmd.ErrOrStderr())

			initClientCtx, err := client.ReadPersistentCommandFlags(initClientCtx, cmd.Flags())
			if err != nil {
				return err
			}

			initClientCtx, err = clientcfg.ReadFromClientConfig(initClientCtx)
			if err != nil {
				return err
			}

			if !initClientCtx.Offline {
				enabledSignModes := append(tx.DefaultSignModes, signing.SignMode_SIGN_MODE_TEXTUAL)
				txConfigOpts := tx.ConfigOptions{
					EnabledSignModes:           enabledSignModes,
					TextualCoinMetadataQueryFn: txmodule.NewGRPCCoinMetadataQueryFn(initClientCtx),
				}
				txConfig, err := tx.NewTxConfigWithOptions(
					initClientCtx.Codec,
					txConfigOpts,
				)
				if err != nil {
					return err
				}

				initClientCtx = initClientCtx.WithTxConfig(txConfig)
			}

			if err := client.SetCmdClientContextHandler(initClientCtx, cmd); err != nil {
				return err
			}

			customAppTemplate, customAppConfig := initAppConfig()
			customTMConfig := initTendermintConfig()

			return sdkserver.InterceptConfigsPreRunHandler(cmd, customAppTemplate, customAppConfig, customTMConfig)
		},
	}

	cfg := sdk.GetConfig()
	cfg.Seal()

	a := appCreator{encodingConfig}
	rootCmd.AddCommand(
		evmosclient.ValidateChainID(
			InitCmd(tempApp.BasicModuleManager, cmdcfg.DefaultNodeHome),
		),
		genutilcli.CollectGenTxsCmd(banktypes.GenesisBalancesIterator{},
			cmdcfg.DefaultNodeHome,
			genutiltypes.DefaultMessageValidator,
			tempApp.GetTxConfig().SigningContext().ValidatorAddressCodec(),
		),
		genutilcli.GenTxCmd(
			tempApp.BasicModuleManager, tempApp.GetTxConfig(),
			banktypes.GenesisBalancesIterator{},
			cmdcfg.DefaultNodeHome,
			tempApp.GetTxConfig().SigningContext().ValidatorAddressCodec(),
		),
		genutilcli.ValidateGenesisCmd(tempApp.BasicModuleManager),
		AddGenesisAccountCmd(cmdcfg.DefaultNodeHome),
		cmtcli.NewCompletionCmd(rootCmd, true),
		evmosdebug.Cmd(),
		confixcmd.ConfigCommand(),
		pruning.Cmd(a.newApp, cmdcfg.DefaultNodeHome),
		snapshot.Cmd(a.newApp),
		block.Cmd(),
	)

	evmosserver.AddCommands(
		rootCmd,
		evmosserver.NewDefaultStartOptions(a.newApp, cmdcfg.DefaultNodeHome),
		a.appExport,
		addModuleInitFlags,
	)

	rootCmd.AddCommand(
		sdkserver.StatusCommand(),
		queryCommand(),
		txCommand(),
		evmosclient.KeyCommands(cmdcfg.DefaultNodeHome),
	)
	rootCmd, err := srvflags.AddTxFlags(rootCmd)
	if err != nil {
		panic(err)
	}

	rootCmd.AddCommand(rosettaCmd.RosettaCommand(encodingConfig.InterfaceRegistry, encodingConfig.Codec))

	autoCliOpts := tempApp.AutoCliOpts()
	initClientCtx, _ = clientcfg.ReadFromClientConfig(initClientCtx)
	autoCliOpts.ClientCtx = initClientCtx

	if err := autoCliOpts.EnhanceRootCommand(rootCmd); err != nil {
		panic(err)
	}

	return rootCmd, encodingConfig
}

func addModuleInitFlags(startCmd *cobra.Command) {
	crisis.AddModuleInitFlags(startCmd)
}

func queryCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:                        "query",
		Aliases:                    []string{"q"},
		Short:                      "Querying subcommands",
		DisableFlagParsing:         true,
		SuggestionsMinimumDistance: 2,
		RunE:                       client.ValidateCmd,
	}

	cmd.AddCommand(
		rpc.QueryEventForTxCmd(),
		rpc.ValidatorCommand(),
		authcmd.QueryTxsByEventsCmd(),
		sdkserver.QueryBlockCmd(),
		authcmd.QueryTxCmd(),
		sdkserver.QueryBlockResultsCmd(),
	)

	cmd.PersistentFlags().String(flags.FlagChainID, "", "The network chain ID")

	return cmd
}

func txCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:                        "tx",
		Short:                      "Transactions subcommands",
		DisableFlagParsing:         true,
		SuggestionsMinimumDistance: 2,
		RunE:                       client.ValidateCmd,
	}

	cmd.AddCommand(
		authcmd.GetSignCommand(),
		authcmd.GetSignBatchCommand(),
		authcmd.GetMultiSignCommand(),
		authcmd.GetMultiSignBatchCmd(),
		authcmd.GetValidateSignaturesCommand(),
		authcmd.GetBroadcastCommand(),
		authcmd.GetEncodeCommand(),
		authcmd.GetDecodeCommand(),
		authcmd.GetSimulateCmd(),
	)

	flags.DefaultGasAdjustment = servercfg.DefaultGasAdjustment
	cmd.PersistentFlags().String(flags.FlagChainID, "", "The network chain ID")

	return cmd
}

func initAppConfig() (string, interface{}) {
	customAppTemplate, customAppConfig := servercfg.AppConfig(cmdcfg.BaseDenom)

	srvCfg, ok := customAppConfig.(servercfg.Config)
	if !ok {
		panic(fmt.Errorf("unknown app config type %T", customAppConfig))
	}

	srvCfg.StateSync.SnapshotInterval = 5000
	srvCfg.StateSync.SnapshotKeepRecent = 2
	srvCfg.IAVLDisableFastNode = false

	return customAppTemplate, srvCfg
}

type appCreator struct {
	encCfg sdktestutil.TestEncodingConfig
}

func (a appCreator) newApp(logger log.Logger, db dbm.DB, traceStore io.Writer, appOpts servertypes.AppOptions) servertypes.Application {
	var cache storetypes.MultiStorePersistentCache

	if cast.ToBool(appOpts.Get(sdkserver.FlagInterBlockCache)) {
		cache = store.NewCommitKVStoreCacheManager()
	}

	skipUpgradeHeights := make(map[int64]bool)
	for _, h := range cast.ToIntSlice(appOpts.Get(sdkserver.FlagUnsafeSkipUpgrades)) {
		skipUpgradeHeights[int64(h)] = true
	}

	pruningOpts, err := sdkserver.GetPruningOptionsFromFlags(appOpts)
	if err != nil {
		panic(err)
	}

	home := cast.ToString(appOpts.Get(flags.FlagHome))
	snapshotDir := filepath.Join(home, "data", "snapshots")
	snapshotDB, err := dbm.NewDB("metadata", sdkserver.GetAppDBBackend(appOpts), snapshotDir)
	if err != nil {
		panic(err)
	}

	snapshotStore, err := snapshots.NewStore(snapshotDB, snapshotDir)
	if err != nil {
		panic(err)
	}

	snapshotOptions := snapshottypes.NewSnapshotOptions(
		cast.ToUint64(appOpts.Get(sdkserver.FlagStateSyncSnapshotInterval)),
		cast.ToUint32(appOpts.Get(sdkserver.FlagStateSyncSnapshotKeepRecent)),
	)

	chainID := cast.ToString(appOpts.Get(flags.FlagChainID))
	if len(chainID) == 0 {
		v := viper.New()
		v.AddConfigPath(filepath.Join(home, "config"))
		v.SetConfigName("client")
		v.SetConfigType("toml")
		if err := v.ReadInConfig(); err != nil {
			panic(err)
		}
		conf := new(clientcfg.ClientConfig)
		if err := v.Unmarshal(conf); err != nil {
			panic(err)
		}
		chainID = conf.ChainID
	}

	evmosApp := app.NewEvmos(
		logger, db, traceStore, true, skipUpgradeHeights,
		cast.ToString(appOpts.Get(flags.FlagHome)),
		cast.ToUint(appOpts.Get(sdkserver.FlagInvCheckPeriod)),
		appOpts,
		baseapp.SetPruning(pruningOpts),
		baseapp.SetMinGasPrices(cast.ToString(appOpts.Get(sdkserver.FlagMinGasPrices))),
		baseapp.SetHaltHeight(cast.ToUint64(appOpts.Get(sdkserver.FlagHaltHeight))),
		baseapp.SetHaltTime(cast.ToUint64(appOpts.Get(sdkserver.FlagHaltTime))),
		baseapp.SetMinRetainBlocks(cast.ToUint64(appOpts.Get(sdkserver.FlagMinRetainBlocks))),
		baseapp.SetInterBlockCache(cache),
		baseapp.SetTrace(cast.ToBool(appOpts.Get(sdkserver.FlagTrace))),
		baseapp.SetIndexEvents(cast.ToStringSlice(appOpts.Get(sdkserver.FlagIndexEvents))),
		baseapp.SetSnapshot(snapshotStore, snapshotOptions),
		baseapp.SetIAVLCacheSize(cast.ToInt(appOpts.Get(sdkserver.FlagIAVLCacheSize))),
		baseapp.SetIAVLDisableFastNode(cast.ToBool(appOpts.Get(sdkserver.FlagDisableIAVLFastNode))),
		baseapp.SetChainID(chainID),
	)

	return evmosApp
}

func (a appCreator) appExport(
	logger log.Logger,
	db dbm.DB,
	traceStore io.Writer,
	height int64,
	forZeroHeight bool,
	jailAllowedAddrs []string,
	appOpts servertypes.AppOptions,
	modulesToExport []string,
) (servertypes.ExportedApp, error) {
	var evmosApp *app.Evmos
	homePath, ok := appOpts.Get(flags.FlagHome).(string)
	if !ok || homePath == "" {
		return servertypes.ExportedApp{}, errors.New("application home not set")
	}

	if height != -1 {
		evmosApp = app.NewEvmos(logger, db, traceStore, false, map[int64]bool{}, "", uint(1), appOpts)

		if err := evmosApp.LoadHeight(height); err != nil {
			return servertypes.ExportedApp{}, err
		}
	} else {
		evmosApp = app.NewEvmos(logger, db, traceStore, true, map[int64]bool{}, "", uint(1), appOpts)
	}

	return evmosApp.ExportAppStateAndValidators(forZeroHeight, jailAllowedAddrs, modulesToExport)
}

func initTendermintConfig() *cmtcfg.Config {
	cfg := cmtcfg.DefaultConfig()
	cfg.Consensus.TimeoutCommit = time.Second * 2
	return cfg
}

func tempDir(defaultHome string) string {
	dir, err := os.MkdirTemp("", "chain99")
	if err != nil {
		dir = defaultHome
	}
	defer os.RemoveAll(dir)
	return dir
}

