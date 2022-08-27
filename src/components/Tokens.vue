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

let $db: any = inject('$db');
let $acuityClient: any = inject('$acuityClient');
let $ethClient: any = inject('$ethClient');
let route = useRoute();
let router = useRouter();

import erc20AbiJson from '../lib/contracts/ERC20.abi.json'
const erc20Abi: any = erc20AbiJson;

const store = main();
const endpoints = computed(() => store.endpoints);
const chains = computed(() => store.ethChains);

const tokenAddress = ref("");
const tokenAddresses: Ref<any[]> = ref([]);

let tokens: any[] = reactive([]);

async function load() {
  for (let address in $ethClient.chainsData[parseInt(store.metaMaskChainId as string)].tokens) {
    tokenAddresses.value.push({
      value: address,
      title: $ethClient.chainsData[parseInt(store.metaMaskChainId as string)].tokens[address],
    });
  }

  tokens.length = 0;
  let tokenList = [];
  let tokenDecimals = [];

  for await (const [key, json] of $db.iterator({
    gt: '/tokens/' + store.metaMaskChainId + '/',
    lt: '/tokens/' + store.metaMaskChainId + '/z',
  })) {
    let address = key.split('/')[3];
    let info = JSON.parse(json);

    tokens.push({
      symbol: info.symbol,
      name: info.name,
      address: address,
      balance: '',
      allowance: '',
    });
    tokenList.push(address);
    tokenDecimals.push(info.decimals);
  }

  let balances = await
  $ethClient.chains[store.metaMaskChainId as string].rpc.methods.getTokenBalances(store.metaMaskAccount, tokenList).call();

  for (let i in balances) {
    tokens[parseInt(i)].balance = $ethClient.formatWei(balances[i]);
  }

  let contract = $ethClient.chainsData[parseInt(store.metaMaskChainId as string)].contracts.atomicSwapERC20;
  let allowances = await
  $ethClient.chains[store.metaMaskChainId as string].rpc.methods.getTokenAllowances(store.metaMaskAccount, contract, tokenList).call();

  for (let i in allowances) {
    if (allowances[i] == '115792089237316195423570985008687907853269984665640564039457584007913129639935') {
      tokens[parseInt(i)].allowance = "∞";
    }
    else {
      tokens[parseInt(i)].allowance = $ethClient.formatWei(allowances[i], tokenDecimals[i]);
    }
  }
}

onMounted(async () => {
  load();
})

watch(() => store.metaMaskChainId, async (newValue, oldValue) => {
  load();
});

async function addToken(event: any) {
  let token = new $ethClient.chains[parseInt(store.metaMaskChainId as string)].web3.eth.Contract(erc20Abi, tokenAddress.value);

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

  await $db.put('/tokens/' + store.metaMaskChainId + '/' + tokenAddress.value, JSON.stringify(info));
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
  await $db.del('/tokens/' + store.metaMaskChainId + '/' + address);
  load();
}

</script>

<template>
  <v-container>
    <v-row>
      <v-col cols="12" md="10">
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
                Balance
              </th>
              <th class="text-right">
                Allowance
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="token in tokens">
              <td>{{ token.symbol }}</td>
              <td>{{ token.name }}</td>
              <td class="text-right">{{ token.balance }}</td>
              <td class="text-right">{{ token.allowance }}</td>
              <td>
                <div class="d-flex" style="gap: 1rem">
                  <v-btn icon density="comfortable" @click="goto(token.address)">
                    <v-icon size="small">mdi-handshake</v-icon>
                  </v-btn>
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
      </v-col>
    </v-row>
  </v-container>
</template>