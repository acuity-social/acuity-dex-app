import {
  web3AccountsSubscribe,
  web3Enable,
  web3FromAddress,
  web3ListRpcProviders,
  web3UseRpcProvider
} from '@polkadot/extension-dapp';
import { ApiPromise, WsProvider } from '@polkadot/api'
import { main } from '../stores/index'

export default class AcuityClient {
	api: any;
  store: any;

	async init() {
    this.store = main();

    let acuityEndpoint = import.meta.env.DEV ? 'ws://127.0.0.1:9946' : 'wss://freemont.acuity.social';
    let wsProvider = new WsProvider(acuityEndpoint);
    this.api = await ApiPromise.create({
      provider: wsProvider,
      types: {
        Balance: 'u128',
        AssetId: '[u8; 32]',
        PriceValue: '(u128, u128)',
        AcuityForeignAddress: '[u8; 32]',
        AcuityHashedSecret: '[u8; 32]',
        AcuitySecret: '[u8; 32]',
        Timestamp: 'u64',
        EthereumAddress: '[u8; 20]',
      },
			rpc: {
        orderbook: {
          getPairSellers: {
            description: '',
            params: [
              {
                name: 'sell_asset_id',
                type: 'AssetId',
              },
              {
                name: 'buy_asset_id',
                type: 'AssetId',
              },
              {
                name: 'offset',
                type: 'u32',
              },
              {
                name: 'count',
                type: 'u32',
              },
              {
		             name: 'at',
		             type: 'Hash',
		             isOptional: true
		           },
            ],
						type: 'Vec<AccountId>',
          },
          getPairSellersOrders: {
            description: '',
            params: [
              {
                name: 'sell_asset_id',
                type: 'AssetId',
              },
              {
                name: 'buy_asset_id',
                type: 'AssetId',
              },
              {
                name: 'offset',
                type: 'u32',
              },
              {
                name: 'count',
                type: 'u32',
              },
              {
		             name: 'at',
		             type: 'Hash',
		             isOptional: true
		           },
            ],
						type: "(Vec<AccountId>, Vec<PriceValue>)",
          },
        },
        atomicSwap: {
          getIndexBlocks: {
            description: '',
            params: [
              {
								name: 'account',
								type: 'AccountId',
							},
              {
		             name: 'at',
		             type: 'Hash',
		             isOptional: true
		           },
            ],
						type: 'Vec<BlockNumber>',
          },
        },
				trustedAccounts: {
					isTrusted: {
						description: 'Is the account trusted',
						params: [
							{
								name: 'account',
								type: 'AccountId',
							},
							{
								name: 'trustee',
								type: 'AccountId',
							},
							{
		             name: 'at',
		             type: 'Hash',
		             isOptional: true
		           },
						],
						type: 'bool',
					},
					isTrustedOnlyDeep: {
						description: '',
						params: [
							{
								name: 'account',
								type: 'AccountId',
							},
							{
								name: 'trustee',
								type: 'AccountId',
							},
							{
								 name: 'at',
								 type: 'Hash',
								 isOptional: true
							 },
						],
						type: 'bool',
					},
					isTrustedDeep: {
						description: '',
						params: [
							{
								name: 'account',
								type: 'AccountId',
							},
							{
								name: 'trustee',
								type: 'AccountId',
							},
							{
								 name: 'at',
								 type: 'Hash',
								 isOptional: true
							 },
						],
						type: 'bool',
					},
					trustedBy: {
						description: '',
						params: [
							{
								name: 'account',
								type: 'AccountId',
							},
							{
								 name: 'at',
								 type: 'Hash',
								 isOptional: true
							 },
						],
						type: 'Vec<AccountId>',
					},
					trustedByThatTrust: {
						description: '',
						params: [
							{
								name: 'account',
								type: 'AccountId',
							},
							{
								name: 'account_is_trusted_by_trusted',
								type: 'AccountId',
							},
							{
								 name: 'at',
								 type: 'Hash',
								 isOptional: true
							 },
						],
						type: 'Vec<AccountId>',
					},
				},
			},
    });

    await this.api.isReady;

    const allInjected = await web3Enable('Acuity DEX');
    if (allInjected.length == 0) {
      return false;
    }

    let unsubscribe = await web3AccountsSubscribe(( accounts ) => {
      this.store.accountsAcuSet(accounts);
    });

		return true;
  }
}
