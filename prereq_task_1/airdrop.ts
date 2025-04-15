import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js"
import wallet from "./dev-wallet.json"


// We're also going to import our wallet and recreate the Keypair object using its private key:
// We're going to import our keypair from the wallet file const
const keypair = Keypair.fromSecretKey(new Uint8Array(wallet)); 

// Now we're going to establish a connection to the Solana devnet: 
// Create a Solana devnet connection to devnet SOL tokens 

const connection = new Connection("https://api.devnet.solana.com"); 

// Finally, we're going to claim 2 devnet SOL tokens:

const airdrop = async () => {
    try {
        // We're going to claim 2 devnet SOL tokens
        const txhash = await connection.requestAirdrop(keypair.publicKey, 2 * LAMPORTS_PER_SOL);
        console.log(txhash);
    }catch(e){
        console.error("error", e);
    }
}

airdrop();