<script setup lang="ts">
import { ref, reactive, inject, onMounted, computed, watch } from 'vue'
import type { Ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  web3Accounts,
  web3Enable,
  web3FromAddress,
  web3ListRpcProviders,
  web3UseRpcProvider
} from '@polkadot/extension-dapp';
import { encodeAddress } from '@polkadot/keyring';
import Web3 from 'web3'

import { main } from '../stores/index'

import erc20AbiJson from '../lib/contracts/ERC20.abi.json'
const erc20Abi: any = erc20AbiJson;

let $db: any = inject('$db');
let $acuityClient: any = inject('$acuityClient');
let $ethClient: any = inject('$ethClient');
let route = useRoute();
let router = useRouter();


const store = main();

const chainId = ref("");
const tokenAddress = ref("");
const tokenAddresses: Ref<any[]> = ref([]);

let tokens: any[] = reactive([]);

async function load() {
  if (!chainId.value) {
    return;
  }
  tokenAddresses.value = [];
  for (let address in $ethClient.chainsData[chainId.value].tokens) {
    tokenAddresses.value.push({
      value: address,
      title: $ethClient.chainsData[chainId.value].tokens[address],
    });
  }

  tokens.length = 0;
  let tokenList = [];

  for await (const [key, json] of $db.iterator({
    gt: '/tokens/' + chainId.value + '/',
    lt: '/tokens/' + chainId.value + '/z',
  })) {
    let address = key.split('/')[3];
    let info = JSON.parse(json);

    tokens.push({
      symbol: info.symbol,
      name: info.name,
      decimals: info.decimals,
      address: address,
      balance: '',
      allowance: '',
    });
    tokenList.push(address);
  }
/*
  if ($ethClient.chains[chainId.value].rpc) {
    let balances: [] = await
    $ethClient.chains[chainId.value].rpc.rpc.methods.getAccountTokenBalances(store.metaMaskAccount, tokenList).call();

    for (let i in balances) {
      tokens[i].balance = $ethClient.formatWei(balances[i], tokens[i].decimals);
    }

    let contract = $ethClient.chainsData[chainId.value].contracts.atomicSwapERC20;
    let allowances: [] = await
    $ethClient.chains[chainId.value].rpc.rpc.methods.getAccountTokenAllowances(store.metaMaskAccount, contract, tokenList).call();

    for (let i in allowances) {
      if (BigInt(allowances[i]) / (BigInt(10) ** BigInt(tokens[i].decimals)) > BigInt(2) ** BigInt(57)) {
        tokens[i].allowance = "unlimited";
      }
      else {
        tokens[i].allowance = $ethClient.formatWei(allowances[i], tokens[i].decimals);
      }
    }
  }*/
}

onMounted(async () => {
  load();
})

watch(() => chainId.value, async (newValue, oldValue) => {
  tokenAddress.value = '';
  load();
});

watch(() => store.metaMaskAccount, async (newValue, oldValue) => {
  load();
});

async function addToken(event: any) {
  let token = new $ethClient.chains[chainId.value].rpc.web3.eth.Contract(erc20Abi, tokenAddress.value);

  let result = await Promise.all([
    token.methods.name().call(),
    token.methods.symbol().call(),
    token.methods.decimals().call(),
  ]);

  let info = {
    name: result[0],
    symbol: result[1],
    decimals: result[2],
  }

  await $db.put('/tokens/' + chainId.value + '/' + tokenAddress.value, JSON.stringify(info));
  load();
}

async function goto(address: string) {
  router.push({
    name: 'token-allowance',
    params: {
      address: address,
    },
  })
}

async function removeToken(address: string) {
  await $db.del('/tokens/' + chainId.value + '/' + address);
  load();
}

</script>

<template>
  <v-container>
    <v-row>
      <v-col cols="12" lg="10">
        <v-select v-model="chainId" :items="store.ethChainSelect" label="Chain"></v-select>
        <v-table class="mb-10">
          <thead>
            <tr>
              <th class="text-left">
                Code
              </th>
              <th class="text-left">
                Name
              </th>
              <th class="text-right">
                Decimals
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="token in tokens">
              <td>{{ token.symbol }}</td>
              <td>{{ token.name }}</td>
              <td class="text-right">{{ token.decimals }}</td>
              <td>
                <div class="d-flex" style="gap: 1rem">
                  <v-btn icon density="comfortable" @click="removeToken(token.address)">
                    <v-icon size="small">mdi-delete</v-icon>
                  </v-btn>
                </div>
              </td>
            </tr>
          </tbody>
        </v-table>
        <v-select
          v-model="tokenAddress"
          :items="tokenAddresses"
          label="Token name"
        ></v-select>
        <v-text-field
          v-model="tokenAddress"
          label="Token address"
        ></v-text-field>
        <v-btn @click="addToken">Add token</v-btn>
        <v-alert type="info" variant="outlined" icon="mdi-circle-multiple" class="mt-8">
          On each chain you can add the tokens you wish to trade with.<br />
          Either select a well-known token or manually enter a token address.
        </v-alert>
      </v-col>
    </v-row>
  </v-container>
</template>
