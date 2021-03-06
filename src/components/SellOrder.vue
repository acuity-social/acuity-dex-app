<script setup lang="ts">
import { ref, reactive, inject, onMounted, computed, watch} from 'vue'

import { useRouter, useRoute } from 'vue-router'
import {
  web3Accounts,
  web3Enable,
  web3FromAddress,
  web3ListRpcProviders,
  web3UseRpcProvider
} from '@polkadot/extension-dapp';
import { encodeAddress } from '@polkadot/keyring';
import { main } from '../stores/index'

let $db: any = inject('$db');
let $acuityClient: any = inject('$acuityClient');
let $ethClient: any = inject('$ethClient');
let route = useRoute();
let router = useRouter();

const store = main();

const locks: any = reactive({});

const sellerAccountId = ref("");
const sellerName = ref("");
const sellChainId = ref(0);
const sellChain = ref("");
const buyChainId = ref(0);
const buyChain = ref("");
const stashed = ref(0);
const price = ref(0);
const value = ref(0);
const total = ref(0);
const buyValue = ref(0);

const buyDisabled = ref(false);
const buyWaiting = ref(false);

const buyCost = computed(() => {
  if (price.value && buyValue.value) {
    return price.value * buyValue.value;
  }
});

let foreignAddress: string;
let priceWei: typeof $ethClient.web3.utils.BN;

const sellSymbol = computed(() => sellChainId.value ? $ethClient.chainsData[sellChainId.value].symbol : '');
const buySymbol = computed(() => buyChainId.value ? $ethClient.chainsData[buyChainId.value].symbol : '');

async function getAcuAddress(foreignAddress: string): Promise<string> {
  return encodeAddress(await $ethClient.chains[buyChainId.value].account.methods.getAcuAccount(foreignAddress).call());
}

async function loadName(address: string): Promise<string> {
  try {
    let result = await $acuityClient.api.query.identity.identityOf(address);
    let json = result.unwrap().info.display.toString();
    let display = JSON.parse(json);
    return $ethClient.web3.utils.hexToAscii(display.raw);
  }
  catch (e) {
    return 'unknown';
  }
}

async function load() {
  let newLocks: any = {};
  let buyHeight = await $ethClient.chains[buyChainId.value].web3.eth.getBlockNumber();

  let events = await $ethClient.chains[buyChainId.value].atomicSwap.getPastEvents('BuyLock', {
    fromBlock: Math.max(buyHeight - 2000, 0),
  });

  for (let event of events) {
    if ((event.returnValues.recipient.toLowerCase() != foreignAddress) ||
      (event.returnValues.sellAssetId != route.params.sellAssetId) ||
      (event.returnValues.sellPrice != priceWei)) {
      continue;
    }

    let acuAddress = await getAcuAddress(event.returnValues.sender);

    let sellLockValue = (parseFloat(event.returnValues.value) / price.value).toString();

    //this.$arbitrumClient.web3.utils.fromWei((BigInt(this.$arbitrumClient.web3.utils.toWei(lock.buyLockValue.toString())) / BigInt(this.priceWei)).toString()),

    newLocks[event.returnValues.lockId] = {
      lockId: event.returnValues.lockId,
      secret: "",
      hashedSecret: event.returnValues.hashedSecret,
      buyerEthAddress: event.returnValues.sender.toLowerCase(),
      buyer: await loadName(acuAddress),
      buyLockValue: $ethClient.formatWei(event.returnValues.value),
      buyLockState: "Locked",
      buyLockTimeoutRaw: event.returnValues.timeout,
      buyLockTimeout: new Date(parseInt(event.returnValues.timeout)).toLocaleString(),
      sellLockValueWei: sellLockValue,
      sellLockValue: $ethClient.formatWei(sellLockValue),
      sellLockState: "Not locked",
      seller: event.returnValues.recipient.toLowerCase(),
      createSellLockDisabled: false,
      createSellLockWaiting: false,
      unlockSellLockDisabled: false,
      unlockSellLockWaiting: false,
      unlockBuyLockDisabled: false,
      unlockBuyLockWaiting: false,
    };
  }

  let sellHeight = await $ethClient.chains[sellChainId.value].web3.eth.getBlockNumber();

  events = await $ethClient.chains[sellChainId.value].atomicSwap.getPastEvents('SellLock', {
    fromBlock: Math.max(sellHeight - 2000, 0),
  });

  for (let event of events) {
    let buyLockId = event.returnValues.buyLockId;
    if (newLocks[buyLockId]) {
      newLocks[buyLockId].sellLockId = event.returnValues.lockId;
      newLocks[buyLockId].sellLockState = "Locked";
      newLocks[buyLockId].sellLockTimeoutRaw = event.returnValues.timeout;
      newLocks[buyLockId].sellLockTimeout = new Date(parseInt(event.returnValues.timeout)).toLocaleString();
    }
  }

  events = await $ethClient.chains[sellChainId.value].atomicSwap.getPastEvents('UnlockByRecipient', {
    fromBlock: Math.max(sellHeight - 2000, 0),
  });

  for (let event of events) {
    // Is it the sell lock?
    if (event.returnValues.sender.toLowerCase() == foreignAddress) {
      // Find the buy lock.
      for (let lockId in newLocks) {
        if (newLocks[lockId].sellLockId == event.returnValues.lockId) {
          newLocks[lockId].secret = event.returnValues.secret;
          newLocks[lockId].sellLockState = "Unlocked";
        }
      }
    }
  }

  events = await $ethClient.chains[buyChainId.value].atomicSwap.getPastEvents('UnlockByRecipient', {
    fromBlock: Math.max(buyHeight - 2000, 0),
  });

  for (let event of events) {

    // Is it the buy lock?
    if (event.returnValues.recipient.toLowerCase() == foreignAddress) {
      newLocks[event.returnValues.lockId].buyLockState = "Unlocked";
    }
  }

  for (let lockId in newLocks) {
    locks[lockId] = newLocks[lockId];
  }
}

let buyEmitter;
let sellEmitter;

onMounted(async () => {
  sellerAccountId.value = route.params.accountId as string;
  sellerName.value = await loadName(sellerAccountId.value);
  sellChainId.value = $ethClient.web3.utils.hexToNumber(route.params.sellAssetId);
  sellChain.value = $ethClient.chainsData[sellChainId.value].label;
  buyChainId.value = $ethClient.web3.utils.hexToNumber(route.params.buyAssetId);
  buyChain.value = $ethClient.chainsData[buyChainId.value].label;

  let chainIdHex = $ethClient.web3.utils.padLeft($ethClient.web3.utils.toHex(sellChainId.value), 16);
  let result = await $acuityClient.api.query.orderbook.accountForeignAccount(sellerAccountId.value, chainIdHex);
  foreignAddress = '0x' + Buffer.from(result).toString('hex').slice(24);

  stashed.value = $ethClient.formatWei(await $ethClient.chains[sellChainId.value].atomicSwap.methods.getStashValue(route.params.buyAssetId, foreignAddress).call());

  result = await $acuityClient.api.query.orderbook.orderbook(route.params.accountId, route.params.sellAssetId, route.params.buyAssetId);

  priceWei = result.price;
  price.value = $ethClient.web3.utils.fromWei(result.price);
  value.value = $ethClient.web3.utils.fromWei(result.value);
  total.value = price.value * value.value;

  buyEmitter = $ethClient.chains[buyChainId.value].atomicSwap.events.allEvents()
  .on('data', function(event: any){
    load();
  });

  sellEmitter = $ethClient.chains[sellChainId.value].atomicSwap.events.allEvents()
  .on('data', function(event: any){
    load();
  });

  load();
});

/*
watch(() => store.metaMaskAccount, async (newValue, oldValue) => {
  load();
});
*/

async function createBuyLock(event: any) {
  buyDisabled.value = true;

  let recipient = foreignAddress;
  let secret = $ethClient.web3.utils.randomHex(32);
  let hashedSecret = $ethClient.web3.utils.keccak256(secret);
  $db.put('/secrets/' + hashedSecret, secret);
  let timeout = Date.now() + 60 * 60 * 3 * 1000;   // 3 hours
  let sellAssetId = route.params.sellAssetId
  let sellPrice = priceWei.toHex();
  let value = $ethClient.web3.utils.fromWei((BigInt($ethClient.web3.utils.toWei(buyValue.value)) * BigInt(priceWei)).toString()).split('.')[0];

  console.log({recipient, hashedSecret, timeout, sellAssetId, sellPrice, value});

  $ethClient.atomicSwap.methods
    .lockBuy(recipient, hashedSecret, timeout, sellAssetId, sellPrice)
    .send({from: store.metaMaskAccount, value: value})
    .on('transactionHash', function(payload: any) {
      buyWaiting.value = true;
    })
    .on('receipt', function(receipt: any) {
      buyWaiting.value = false;
      buyDisabled.value = false;
    })
    .on('error', function(error: any) {
      buyWaiting.value = false;
      buyDisabled.value = false;
    });
}

async function createSellLock(lock: any) {
  locks[lock.lockId].createSellLockDisabled = true;

  console.log(lock);

  let recipient = lock.buyerEthAddress;
  let hashedSecret = lock.hashedSecret;
  let timeout = Date.now() + 60 * 60 * 2 * 1000;   // 2 hours
  let stashAssetId = route.params.buyAssetId;
  let value = $ethClient.web3.utils.numberToHex(lock.sellLockValueWei);
  let buyLockId = lock.lockId;

  console.log({recipient, hashedSecret, timeout, stashAssetId, value, buyLockId});

  $ethClient.atomicSwap.methods
    .lockSell(recipient, hashedSecret, timeout, stashAssetId, value, buyLockId)
    .send({from: store.metaMaskAccount})
    .on('transactionHash', function(payload: any) {
      locks[lock.lockId].createSellLockWaiting = true;
    })
    .on('receipt', function(receipt: any) {
      locks[lock.lockId].createSellLockWaiting = false;
      locks[lock.lockId].createSellLockDisabled = false;
    })
    .on('error', function(error: any) {
      locks[lock.lockId].createSellLockWaiting = false;
      locks[lock.lockId].createSellLockDisabled = false;
    });
}

async function unlockSellLock(lock: any) {
  locks[lock.lockId].unlockSellLockDisabled = true;

  let sender = lock.seller;
  let secret = await $db.get('/secrets/' + lock.hashedSecret);
  let timeout = lock.sellLockTimeoutRaw;

  console.log({sender, secret, timeout});

  $ethClient.atomicSwap.methods
    .unlockByRecipient(sender, secret, timeout)
    .send({from: store.metaMaskAccount})
    .on('transactionHash', function(payload: any) {
      locks[lock.lockId].unlockSellLockWaiting = true;
    })
    .on('receipt', function(receipt: any) {
      locks[lock.lockId].unlockSellLockWaiting = false;
      locks[lock.lockId].unlockSellLockDisabled = false;
    })
    .on('error', function(error: any) {
      locks[lock.lockId].unlockSellLockWaiting = false;
      locks[lock.lockId].unlockSellLockDisabled = false;
    });
}

async function unlockBuyLock(lock: any) {
  locks[lock.lockId].unlockBuyLockDisabled = true;

  let sender = lock.buyerEthAddress;
  let secret = lock.secret;
  let timeout = lock.buyLockTimeoutRaw;

  console.log({sender, secret, timeout});

  $ethClient.atomicSwap.methods
    .unlockByRecipient(sender, secret, timeout)
    .send({from: store.metaMaskAccount})
    .on('transactionHash', function(payload: any) {
      locks[lock.lockId].unlockBuyLockWaiting = true;
    })
    .on('receipt', function(receipt: any) {
      locks[lock.lockId].unlockBuyLockWaiting = false;
      locks[lock.lockId].unlockBuyLockDisabled = false;
    })
    .on('error', function(error: any) {
      locks[lock.lockId].unlockBuyLockWaiting = false;
      locks[lock.lockId].unlockBuyLockDisabled = false;
    });
}

</script>

<template>
  <v-container>
    <v-row>
      <v-col cols="12" md="12">
        <v-table class="mb-10">
          <thead>
            <tr>
              <th class="text-left">
                Buyer
              </th>
              <th class="text-left">
                Buy Lock ({{ buySymbol }})
              </th>
              <th class="text-left">
                State
              </th>
              <th class="text-left">
                Timeout
              </th>
              <th class="text-left"></th>
              <th style="background-color: rgba(18, 18, 18);"></th>
              <th class="text-left">
                Sell Lock ({{ sellSymbol }})
              </th>
              <th class="text-left">
                State
              </th>
              <th class="text-left">
                Timeout
              </th>
              <th class="text-left"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(lock, lockId) in locks" :key="lockId">
              <td>{{ lock.buyer }}</td>
              <td>{{ lock.buyLockValue }}</td>
              <td>{{ lock.buyLockState }}</td>
              <td>{{ lock.buyLockTimeout }}</td>
              <td>
                <v-btn v-if="lock.buyLockState == 'Locked' && lock.sellLockState == 'Unlocked' && store.metaMaskChainId == buyChainId && store.metaMaskAccount == lock.seller" size="small" @click="unlockBuyLock(lock)" :disabled="lock.unlockBuyLockDisabled">
                  <v-icon size="small" v-if="!lock.unlockBuyLockWaiting">mdi-lock-open-variant</v-icon>
                  <v-progress-circular v-else indeterminate color="yellow darken-2" size="20"></v-progress-circular>
                </v-btn>
              </td>
              <td style="background-color: rgb(18, 18, 18);"></td>
              <td>{{ lock.sellLockValue }}</td>
              <td>{{ lock.sellLockState }}</td>
              <td>{{ lock.sellLockTimeout }}</td>
              <td>
                <v-btn v-if="lock.sellLockState == 'Not locked' && store.metaMaskChainId == sellChainId && store.metaMaskAccount == lock.seller" size="small" @click="createSellLock(lock)" :disabled="lock.createSellLockDisabled">
                  <v-icon size="small" v-if="!lock.createSellLockWaiting">mdi-lock</v-icon>
                  <v-progress-circular v-else indeterminate color="yellow darken-2" size="20"></v-progress-circular>
                </v-btn>
                <v-btn v-if="lock.sellLockState == 'Locked' && store.metaMaskChainId == sellChainId && store.metaMaskAccount == lock.buyerEthAddress" size="small" @click="unlockSellLock(lock)" :disabled="lock.unlockSellLockDisabled">
                  <v-icon size="small" v-if="!lock.unlockSellLockWaiting">mdi-lock-open-variant</v-icon>
                  <v-progress-circular v-else indeterminate color="yellow darken-2" size="20"></v-progress-circular>
                </v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12" md="10">
        <v-text-field readonly v-model="sellerName" label="Seller" hint="Who is selling." persistent-hint></v-text-field>
        <v-text-field readonly v-model="sellChain" label="Sell chain" hint="Asset being sold." persistent-hint></v-text-field>
        <v-text-field readonly v-model="buyChain" label="Buy chain" hint="Asset to pay with." persistent-hint></v-text-field>
        <v-text-field readonly v-model="stashed" label="Stashed" :suffix="sellSymbol" hint="Value seller has stashed for this pair." persistent-hint></v-text-field>
        <v-text-field readonly v-model="price" label="Price" :suffix="buySymbol + ' / ' + sellSymbol" hint="Price asset is being sold for." persistent-hint></v-text-field>
        <v-text-field readonly v-model="value" label="Value" :suffix="sellSymbol" hint="How much is for sale." persistent-hint></v-text-field>
        <v-text-field readonly v-model="total" label="Total" :suffix="buySymbol" hint="Maximum that can be paid." persistent-hint></v-text-field>
        <v-text-field v-model="buyValue" label="Buy value" :suffix="sellSymbol" hint="How much you want to buy." persistent-hint></v-text-field>
        <v-text-field readonly v-model="buyCost" label="Cost" :suffix="buySymbol" hint="Cost to buy." persistent-hint></v-text-field>
        <v-btn @click="createBuyLock" class="mt-4 mb-4"  :disabled="buyDisabled || (buyChainId != store.metaMaskChainId)">Buy</v-btn>
        <v-progress-linear class="mb-10" :indeterminate="buyWaiting" color="yellow darken-2"></v-progress-linear>
      </v-col>
    </v-row>
  </v-container>
</template>
