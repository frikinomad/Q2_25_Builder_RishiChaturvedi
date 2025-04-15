import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from "@solana/web3.js"
import { Program, Wallet, AnchorProvider, Idl } from "@coral-xyz/anchor"
// import { IDL, Turbin3Prereq } from "./programs/Turbin3_prereq";
import wallet from "./Turbin3-wallet.json"

// We're going to import our keypair from the wallet file
const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));

const connection = new Connection("https://api.devnet.solana.com"); 

// To register ourselves as having completed pre-requisites, we need to submit our github account name as a utf8 buffer:

// Github account
const github = Buffer.from("frikinomad", "utf8");

const provider = new AnchorProvider(connection, new Wallet(keypair), {commitment: "confirmed"});

const getIdl = async() => {
    const idl = await Program.fetchIdl("Trb3aEx85DW1cEEvoqEaBkMn1tfmNEEEPaKzLSu4YAv", provider);
    // console.log(idl);
    const program = new Program(idl, provider);

    // Create the PDA for our enrollment account
    const enrollment_seeds = [Buffer.from("pre"), keypair.publicKey.toBuffer()];
    // Enrollment Key is the PDA address, _bump is not used anyways
    const [enrollment_key, _bump] = PublicKey.findProgramAddressSync(enrollment_seeds, program.programId);
    
    console.log(enrollment_key.toString());
    

    // Execute our enrollment transaction
    (async () => {
        try {
            // const txhash = await program.methods.submit(github)
            // .accounts({
            //     signer: keypair.publicKey,
            //     enrollment_key,
            // })
            // .signers([
            //     keypair
            // ])
            // .rpc();

            const tx = await program.methods.submit(github)
            .accounts({
                signer: keypair.publicKey,
            })
            .signers([
                keypair
            ])
            .instruction();
            const transaction = new Transaction();
            transaction.add(tx)
            transaction.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
            transaction.feePayer = keypair.publicKey;    
            const simulationResult = await connection.simulateTransaction(transaction);
            console.log(simulationResult);
            
            if (simulationResult.value.err) console.error("Simulation failed with error:");
            else console.log("Simulation successful.");
            
            // console.log(`Success! Check out your TX here: https://explorer.solana.com/tx/${txhash}?cluster=devnet`);
        } catch(e) {
            console.error(`Oops, something went wrong: ${e}`)
        }
    })();
}
getIdl()

