import detectEthereumProvider from '@metamask/detect-provider';
import Web3 from 'web3'
import { encodeAddress } from '@polkadot/keyring';
import { main } from '../stores/index'
let store: any;

import ethChainsDataJson from '../lib/eth-chains-testnets.json'

import accountAbiJson from '../lib/contracts/AcuityAccount.abi.json'
const accountAbi: any = accountAbiJson;

import atomicSwapAbiJson from '../lib/contracts/AcuityAtomicSwap.abi.json'
const atomicSwapAbi: any = atomicSwapAbiJson;

function newEndpoint(chainId: number, uri: string) {
  let web3 = new Web3(uri);

  web3.eth.getBlockNumber()
    .then(height => {
      store.chainHeightSet(chainId, height);
    })
    .catch(() => {});

  web3.eth.subscribe('newBlockHeaders')
    .on('data', data => {
      store.chainHeightSet(chainId, data.number);
    })
    .on('error', () => {});

  return web3;
}

export default class EthClient {
  db: any;
  provider: any;
	web3: any;
  formatWei: any;
  account: any;
  atomicSwap: any;
	chains: { [key: number]: any; } = {};
  chainsData: any = ethChainsDataJson;

  async loadAcuAccount() {
    if (this.chains.hasOwnProperty(store.metaMaskChainId)) {
      let mappedAcuAddress = encodeAddress(await this.chains[store.metaMaskChainId].account.methods.getAcuAccount(store.metaMaskAccount).call());
      store.activeAcuSet(mappedAcuAddress);
    }
  }

	async init(db: any) {
    this.db = db;
    this.provider = await detectEthereumProvider();
		store = main();

    if (this.provider) {
      this.web3 = new Web3(this.provider);
  		this.web3.eth.defaultBlock = 'pending';
  		this.web3.eth.transactionConfirmationBlocks = 1;
      this.formatWei = (wei: string) => Number(this.web3.utils.fromWei(this.web3.utils.toBN(wei))).toLocaleString();

      (window.ethereum as any)
        .on('chainChanged', (chainIdHex: string) => {
          let chainId = parseInt(chainIdHex, 16);
          store.metaMaskChainIdSet(chainId);
          if (this.chainsData.hasOwnProperty(chainId)) {
            this.account = new this.web3.eth.Contract(accountAbi, this.chainsData[chainId].contracts.account);
        		this.atomicSwap = new this.web3.eth.Contract(atomicSwapAbi, this.chainsData[chainId].contracts.atomicSwap);
          }
          this.loadAcuAccount();
        })
        .on('accountsChanged', (accounts: any) => {
  				store.metaMaskAccountSet(accounts[0].toLowerCase());
          this.loadAcuAccount();
        });

      let chainId = await this.web3.eth.getChainId();
      store.metaMaskChainIdSet(chainId);

      if (this.chainsData.hasOwnProperty(chainId)) {
        this.account = new this.web3.eth.Contract(accountAbi, this.chainsData[chainId].contracts.account);
    		this.atomicSwap = new this.web3.eth.Contract(atomicSwapAbi, this.chainsData[chainId].contracts.atomicSwap);
      }

      let accounts = await this.web3.eth.requestAccounts();
			store.metaMaskAccountSet(accounts[0].toLowerCase());

			for await (const [key, uri] of this.db.iterator({
		    gt: '/chains/'
		  })) {
		    let chainId = parseInt(key.slice(8));

				if (Number.isInteger(chainId)) {
          this.loadChain(chainId, uri);
				}
		  }

      this.loadAcuAccount();
    } else {
      console.log('Please install MetaMask!');
    }

		return this;
  }

  loadChain(chainId: number, uri: string) {
    store.chainSet(chainId, this.chainsData[chainId].label, uri);
    let web3 = newEndpoint(chainId, uri);
    this.chains[chainId] = {};
    this.chains[chainId].web3 = web3;
    if (this.chainsData[chainId].contracts.account) {
      this.chains[chainId].account = new web3.eth.Contract(accountAbi, this.chainsData[chainId].contracts.account);
    }
    if (this.chainsData[chainId].contracts.atomicSwap) {
      this.chains[chainId].atomicSwap = new web3.eth.Contract(atomicSwapAbi, this.chainsData[chainId].contracts.atomicSwap);
    }
//				this.chains[chainId].atomicSwapERC20 =
  }

  async addChain(chainId: number, uri: string) {
    this.db.put('/chains/' + chainId, uri);
    this.loadChain(chainId, uri);
  }

  async removeChain(chainId: number) {
    this.db.del('/chains/' + chainId);
    this.chains[chainId] = {};
    store.chainRemove(chainId);
  }

  async addChainToMetaMask(chainId: number, uri: string) {
    const params = {
      chainId: this.web3.utils.numberToHex(chainId),
      chainName: this.chainsData[chainId].label,
      nativeCurrency: {
        name: this.chainsData[chainId].label,
        symbol: this.chainsData[chainId].symbol,
        decimals: 18,
      },
      rpcUrls: [uri],
      blockExplorerUrls: (this.chainsData[chainId].explorers.length > 0) ? this.chainsData[chainId].explorers : null,
      iconUrls: [],
    };

    this.provider.request({
      method: "wallet_addEthereumChain",
      params: [params],
    })
    .catch((error: any) => {});
  }
}
