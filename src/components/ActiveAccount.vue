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

const name = ref("");
const web = ref("");
const riot = ref("");
const twitter = ref("");
const telegram = ref("");

const setNameDisabled = ref(false);
const setNameWaiting = ref(false);
const setForeignAccountDisabled = ref(false);
const setForeignAccountWaiting = ref(false);
const setAcuAccountDisabled = ref(false);
const setAcuAccountWaiting = ref(false);

async function load() {
  let result = await $acuityClient.api.query.identity.identityOf(store.activeAcu);

  name.value = '';
  web.value = '';
  riot.value = '';
  twitter.value = '';
  telegram.value = '';

  try {
    let info = result.unwrap().info;

    try {
      name.value = $ethClient.web3.utils.hexToAscii(JSON.parse(info.display.toString()).raw);
    }
    catch (e) {}

    try {
      web.value = $ethClient.web3.utils.hexToAscii(JSON.parse(info.web.toString()).raw);
    }
    catch (e) {}

    try {
      riot.value = $ethClient.web3.utils.hexToAscii(JSON.parse(info.riot.toString()).raw);
    }
    catch (e) {}

    try {
      twitter.value = $ethClient.web3.utils.hexToAscii(JSON.parse(info.twitter.toString()).raw);
    }
    catch (e) {}

    try {
      telegram.value = $ethClient.web3.utils.hexToAscii(JSON.parse(info.additional.toString())[0][1].raw);
    }
    catch (e) {}
  }
  catch (e) {}

  await $ethClient.loadAccounts();
  $ethClient.loadBalances();
};

onMounted(async () => {
  $acuityClient.api.query.system.events((events: any[]) => {
    events.forEach((record) => {
      // Extract the phase, event and the event types
      const { event, phase } = record;
      if (event.section == 'orderbook') {
        load();
      }
    });
  });

  for (let chainId of Object.keys(store.ethChains)) {
    let emitter = $ethClient.chains[chainId].ws.account.events.allEvents()
  	.on('data', async (log: any) => {
      load();
    });
  }

  load();
});

watch(() => store.activeAcu, async (newValue, oldValue) => {
  load();
});

function encodeString(text: string) {
  if (text.length == 0) {
    return null;
  }
  return $ethClient.web3.utils.padLeft($ethClient.web3.utils.numberToHex(text.length + 1), 2) +  $ethClient.web3.utils.asciiToHex(text).slice(2);
}

async function setIdentity(event: any) {
  setNameDisabled.value = true;
  const injector = await web3FromAddress(store.activeAcu);

  const identity = {
    "additional": [[encodeString("telegram"), encodeString(telegram.value)]],
    "display": encodeString(name.value),
    "legal": null,
    "web": encodeString(web.value),
    "riot": encodeString(riot.value),
    "email": null,
    "pgpFingerprint": null,
    "image": null,
    "twitter": encodeString(twitter.value),
  };

  console.log(identity);

  try {
    const unsub = await $acuityClient.api.tx.identity
      .setIdentity(identity)
      .signAndSend(store.activeAcu, { signer: injector.signer }, ({ status, events }: any) => {
        if (!status.isInBlock) {
          setNameWaiting.value = true;
        }
        else {
          unsub();
          events
            // find/filter for failed events
            .filter(({ event }: any) =>
              $acuityClient.api.events.system.ExtrinsicFailed.is(event)
            )
            // we know that data for system.ExtrinsicFailed is
            // (DispatchError, DispatchInfo)
            .forEach(({ event: { data: [error, info] } }: any) => {
              if (error.isModule) {
                // for module errors, we have the section indexed, lookup
                const decoded = $acuityClient.api.registry.findMetaError(error.asModule);
                const { docs, method, section } = decoded;

                store.errorSet(`${section}.${method}: ${docs.join(' ')}`);
              } else {
                // Other, CannotLookup, BadOrigin, no extra info
                store.errorSet(error.toString());
              }
            });
          setNameWaiting.value = false;
          setNameDisabled.value = false;
          load();
        }
      });
  }
  catch (e) {
    setNameWaiting.value = false;
    setNameDisabled.value = false;
  }
}

async function setForeignAccount(event: any) {
  setForeignAccountDisabled.value = true;
  const injector = await web3FromAddress(store.activeAcu);
  let chainId = '0x0002';
  chainId += $ethClient.web3.utils.stripHexPrefix($ethClient.web3.utils.padLeft($ethClient.web3.utils.toHex(store.metaMaskChainId), 12));
  let foreignAccount = $ethClient.web3.utils.padLeft(store.metaMaskAccount, 64);
  try {
    const unsub = await $acuityClient.api.tx.orderbook
      .setForeignAccount(chainId, foreignAccount)
      .signAndSend(store.activeAcu, { signer: injector.signer }, ({ status, events }: any) => {
        if (!status.isInBlock) {
          setForeignAccountWaiting.value = true;
        }
        else {
          unsub();
          events
            // find/filter for failed events
            .filter(({ event }: any) =>
              $acuityClient.api.events.system.ExtrinsicFailed.is(event)
            )
            // we know that data for system.ExtrinsicFailed is
            // (DispatchError, DispatchInfo)
            .forEach(({ event: { data: [error, info] } }: any) => {
              if (error.isModule) {
                // for module errors, we have the section indexed, lookup
                const decoded = $acuityClient.api.registry.findMetaError(error.asModule);
                const { docs, method, section } = decoded;

                store.errorSet(`${section}.${method}: ${docs.join(' ')}`);
              } else {
                // Other, CannotLookup, BadOrigin, no extra info
                store.errorSet(error.toString());
              }
            });
          setForeignAccountWaiting.value = false;
          setForeignAccountDisabled.value = false;
          load();
        }
      });
  }
  catch (e) {
    setForeignAccountWaiting.value = false;
    setForeignAccountDisabled.value = false;
  }
}

async function setAcuAccount(event: any) {
  setAcuAccountDisabled.value = true;
  let acuAddressHex = '0x' + Buffer.from(decodeAddress(store.activeAcu)).toString('hex');
  await $ethClient.account.methods
    .setAcuAccount(acuAddressHex)
    .send({from: store.metaMaskAccount})
    .on('transactionHash', function(payload: any) {
      setAcuAccountWaiting.value = true;
    })
    .on('receipt', function(receipt: any) {
      setAcuAccountWaiting.value = false;
      setAcuAccountDisabled.value = false;
    })
    .on('error', function(error: any) {
      store.errorSet(error.message);
      setAcuAccountWaiting.value = false;
      setAcuAccountDisabled.value = false;
    });
    await $ethClient.loadAccounts();
  $ethClient.loadBalances();
}

</script>

<template>
  <v-container>
    <v-row>
      <v-col cols="12" lg="10">
        <v-card class="mb-10">
          <v-toolbar color="blue">
            <v-toolbar-title>Public Identity</v-toolbar-title>
          </v-toolbar>
          <v-card-text>
            <v-text-field v-model="name" label="Name" hint="Enter your name."></v-text-field>
<!--
            <v-text-field v-model="web" label="Website" hint="Enter your website address."></v-text-field>
            <v-text-field v-model="twitter" label="Twitter" hint="Enter your Twitter handle."></v-text-field>
            <v-text-field v-model="riot" label="Matrix" hint="Enter your Matrix ID."></v-text-field>
-->
            <v-text-field v-model="telegram" label="Telegram" prefix="@" hint="Enter your Telegram ID."></v-text-field>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="success" @click="setIdentity" :disabled="setNameDisabled">Set Identity</v-btn>
          </v-card-actions>
          <v-progress-linear :indeterminate="setNameWaiting" color="yellow darken-2"></v-progress-linear>
        </v-card>
        <v-alert type="info" variant="outlined" icon="mdi-account" class="mb-8">
          Your name and Telegram ID are stored publicly on the Acuity blockchain so other traders can contact you.
        </v-alert>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12" lg="10">
        <v-table class="mb-10">
          <thead>
            <tr>
              <th>
                Chain
              </th>
              <th>
                Address
              </th>
              <th>
                Connected
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="chain in store.ethChains" :bgcolor="(chain.chainId == store.metaMaskChainId) ? '#2196f3' : ''">
              <td>{{ chain.label }}</td>
              <td><span v-if="store.acuAccountForeignAccount[chain.chainId]">{{ store.acuAccountForeignAccount[chain.chainId][store.activeAcu] }}</span></td>
              <td><span v-if="store.foreignAccountAcuAccount[chain.chainId] && (store.foreignAccountAcuAccount[chain.chainId][store.acuAccountForeignAccount[chain.chainId][store.activeAcu]] == store.activeAcu)">yes</span></td>
            </tr>
          </tbody>
        </v-table>

        <div v-if="store.metaMaskChainId && store.ethChains[store.metaMaskChainId]" class="mt-10" >
          <v-btn class="mb-4" @click="setForeignAccount" :disabled="setForeignAccountDisabled">Set {{ store.metaMaskChainName }} Account on Acuity</v-btn>
          <v-progress-linear class="mb-10" :indeterminate="setForeignAccountWaiting" color="yellow darken-2"></v-progress-linear>

          <v-btn class="mb-4" @click="setAcuAccount" :disabled="setAcuAccountDisabled">Set Acuity Account on {{ store.metaMaskChainName }}</v-btn>
          <v-progress-linear class="mb-10" :indeterminate="setAcuAccountWaiting" color="yellow darken-2"></v-progress-linear>
        </div>
        <v-alert type="info" variant="outlined" icon="mdi-swap-horizontal" class="mb-8">
          In order to trade, your accounts must have a two-way connection with your Acuity account.
        </v-alert>
      </v-col>
    </v-row>
  </v-container>
</template>
