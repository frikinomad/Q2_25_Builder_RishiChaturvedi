import { Keypair } from "@solana/web3.js";
import { HDKey } from "micro-ed25519-hdkey";
import * as bip39 from "bip39";

const mnemonic =
  "media smooth toward mask primary win lizard aerobic aware knee elephant basic";

// arguments: (mnemonic, password)
// const seed = bip39.mnemonicToSeedSync(mnemonic, "");
// const keypair = Keypair.fromSeed(seed.slice(0, 32));
// // 2rTAzH8eZN43Zox7LAujzgbrvFPcGa2DZnQhftvGzKDJ
// console.log(keypair);
// console.log(`${keypair.publicKey.toBase58()}`);


// arguments: (mnemonic, password)
const seed = bip39.mnemonicToSeedSync(mnemonic, "");
const hd = HDKey.fromMasterSeed(seed.toString("hex"));

for (let i = 0; i < 10; i++) {
  const path = `m/44'/501'/0'/0'`;
  const keypair = Keypair.fromSeed(hd.derive(path).privateKey);
  console.log(keypair);
  
  console.log(`${path} => ${keypair.publicKey.toBase58()}`);
}