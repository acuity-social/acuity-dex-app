<script setup lang="ts">
import { ref, inject, onMounted, computed, watch} from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Buffer } from "buffer";
import {
  web3Accounts,
  web3Enable,
  web3FromAddress,
  web3ListRpcProviders,
  web3UseRpcProvider
} from '@polkadot/extension-dapp';
import { encodeAddress, decodeAddress } from '@polkadot/keyring';
import { main } from '../stores/index'

let $db: any = inject('$db');
let $acuityClient: any = inject('$acuityClient');
let $ethClient: any = inject('$ethClient');
let route = useRoute();
let router = useRouter();

const store = main();

let balanceUnsub: any;

watch(() => store.activeAcu, async (newValue, oldValue) => {
  console.log("Switched to account", newValue);
  $db.put('/activeAccount', newValue);

  try {
    balanceUnsub()
  }
  catch (e) {}

  balanceUnsub = $acuityClient.api.query.system.account(newValue, (result: any) => {
    store.acuBalanceSet(newValue, $ethClient.formatWei(result.data.free));
  });

  await $ethClient.loadAccounts();
  $ethClient.loadBalances();
});


onMounted(async () => {
  await Promise.all([
		$acuityClient.init(),
		$ethClient.init($db, $acuityClient),
	]);

  store.setLoaded();

  try {
    let activeAccount = await $db.get('/activeAccount');
    store.activeAcuSet(activeAccount);
  }
  catch (e) {}

  $acuityClient.api.rpc.chain.subscribeNewHeads((lastHeader: any) => {
    store.setAcuBlockNumber(parseInt(lastHeader.number).toLocaleString());
  });

  await $ethClient.loadAccounts();
  $ethClient.loadBalances();
});

</script>

<template>
  <v-container>
  </v-container>
</template>