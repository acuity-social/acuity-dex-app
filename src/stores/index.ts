import { defineStore } from 'pinia'

import ethChainsDataJson from '../lib/eth-chains-testnets.json'
const chainsData: any = ethChainsDataJson;

export const main = defineStore('main', {
  state: () => ({
		activeAcu: "" as string,
    activeAcuName: "" as string,
		accountsAcu: [] as any[],
    addressesAcu: [] as string[],
    metaMaskChainId: null as null | number,
    metaMaskChainName: "" as string,
    metaMaskAccount: "" as string,
    sellChainId: null as null | number,
    buyChainId: null as null | number,
    endpoints: {} as any,
    chains: {} as any,
    chainSelect: [] as any[],
    foreignAccountAcuAccount: {} as any,
    acuAccountForeignAccount: {} as any,
  }),
  getters: {
  },
  actions: {
		activeAcuSet(address: string) {
			this.activeAcu = address;

      for (let account of this.accountsAcu) {
        if (account.value == address) {
          this.activeAcuName = account.title;
        }
      }
		},
		accountsAcuSet(accounts: any[]) {
			this.accountsAcu = [];
      this.addressesAcu = [];

      for (let account of accounts) {
          this.accountsAcu.push({title: account.meta.name, value: account.address});
          this.addressesAcu.push(account.address);
      }
    },
    metaMaskChainIdSet(chainId: number) {
			this.metaMaskChainId = chainId;
      this.metaMaskChainName = chainsData[chainId] ? chainsData[chainId].label : chainId;
      console.log("MetaMask switched to", this.metaMaskChainName);
		},
    metaMaskAccountSet(account: string) {
			this.metaMaskAccount = account;
      console.log("MetaMask switched to account", account);
		},
    sellChainIdSet(chainId: number) {
      this.sellChainId = chainId;
    },
    buyChainIdSet(chainId: number) {
      this.buyChainId = chainId;
    },
    endpointsSet(endpoints: string[]) {
      this.endpoints = {};

      for (let endpoint of endpoints) {
        this.endpoints[endpoint] = {};
      }
    },
    endpointHeightSet(endpoint: string, height: number) {
      this.endpoints[endpoint].height = height;
    },
    chainSet(chainId: number, label: string, uri: string) {
      if (!(chainId in this.chains)) {
        this.chainSelect.push({
          value: chainId,
          title: label,
        });
      }
      this.chains[chainId] = {
        chainId: chainId,
        label: label,
        uri: uri,
        height: null,
      };
    },
    chainRemove(chainId: number, label: string, uri: string) {
      delete this.chains[chainId];

      for (let i in this.chainSelect) {
        if (this.chainSelect[i].value == chainId) {
          delete this.chainSelect[i];
          break;
        }
      }
    },
    chainHeightSet(chainId: number, height: number) {
      this.chains[chainId].height = height;
    },
    foreignAccountAcuAccountSet(chainId: number, foreignAccount: string, acuAccount: string) {
      this.foreignAccountAcuAccount[chainId] = {};
      this.foreignAccountAcuAccount[chainId][foreignAccount] = acuAccount;
    },
    acuAccountForeignAccountSet(chainId: number, acuAccount: string, foreignAccount: string) {
      this.acuAccountForeignAccount[chainId] = {};
      this.acuAccountForeignAccount[chainId][acuAccount] = foreignAccount;
    },
  },
})
