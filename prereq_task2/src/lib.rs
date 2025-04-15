mod programs;

#[cfg(test)]
mod tests {

    // for keygen
    use solana_sdk;
    use solana_sdk::signature::{Keypair, Signer};
    use solana_sdk::signer::EncodableKey;

    use bs58;
    use std::io::{self, BufRead};

    // for airdrop
    use solana_client::rpc_client::RpcClient;
    use solana_sdk::signature::read_keypair_file;

    // for transfer
    use solana_program::{pubkey::Pubkey, system_instruction::transfer, system_program};
    use solana_sdk::transaction::Transaction;
    use std::str::FromStr;

    use solana_sdk::message::Message;

    // enroll
    use crate::programs::turbin3_prereq::{CompleteArgs, TurbinePrereqProgram};
    
    const RPC_URL: &str = "https://api.devnet.solana.com";

    #[test]
    fn keygen() {
        // Create a new keypair

        let kp = Keypair::new();
        println!(
            "You've generated a new Solana wallet: {}",
            kp.pubkey().to_string()
        );
        println!("{:?}", kp.secret().as_bytes());
        kp.write_to_file("dev_wallet.json")
            .expect("Failed to write keypair to file");
        println!("To save your wallet, copy and paste the following into a JSON file:");
    }

    #[test]
    fn base58_to_wallet() {
        println!("Enter private key (base58):");
        let stdin = io::stdin();
        let base58 = stdin.lock().lines().next().unwrap().unwrap();
        let wallet = bs58::decode(base58).into_vec().unwrap();
        println!("Wallet file format:\n{:?}", wallet);
    }

    #[test]
    fn wallet_to_base58() {
        println!("Enter wallet file byte array:");
        let stdin = io::stdin();
        let wallet = stdin
            .lock()
            .lines()
            .next()
            .unwrap()
            .unwrap()
            .trim_matches(|c| c == '[' || c == ']')
            .split(',')
            .map(|s| s.trim().parse::<u8>().unwrap())
            .collect::<Vec<u8>>();
        println!(
            "Base58 private key:\n{}",
            bs58::encode(wallet).into_string()
        );
    }

    #[test]
    fn airdop() {
        let keypair = read_keypair_file("dev_wallet.json").expect("Couldn't find wallet file");

        let client = RpcClient::new(RPC_URL);

        match client.request_airdrop(&keypair.pubkey(), 2_000_000_000u64) {
            Ok(s) => {
                println!("Success! Check out your TX here:");
                println!(
                    "https://explorer.solana.com/tx/{}?cluster=devnet",
                    s.to_string()
                );
            }
            Err(e) => println!("Oops, something went wrong: {}", e.to_string()),
        };
    }

    #[test]
    fn transfer_sol() {
        // Import our keypair
        let keypair = read_keypair_file("dev_wallet.json").expect("Couldn't find wallet file");

        // With the imported Keypair, we can sign a new message.
        // let pubkey = keypair.pubkey();
        // let message_bytes = b"I verify my solana Keypair!";
        // let sig = keypair.sign_message(message_bytes);
        // // let sig_hashed = hash(sig.as_ref());

        // // After that we can verify the singature, using the default implementation
        // match sig.verify(&pubkey.to_bytes(), &sig_hashed.to_bytes()) {
        //     true => println!("Signature verified"),
        //     false => println!("Verification failed"),
        // }

        // Define our Turbin3 public key
        let to_pubkey = Pubkey::from_str("2rTAzH8eZN43Zox7LAujzgbrvFPcGa2DZnQhftvGzKDJ").unwrap();

        // Create a Solana devnet connection
        let rpc_client = RpcClient::new(RPC_URL);

        // Get recent blockhash
        let recent_blockhash = rpc_client
            .get_latest_blockhash()
            .expect("Failed to get recent blockhash");

        // empty wallet
        // Get balance of dev wallet
        let balance = rpc_client
            .get_balance(&keypair.pubkey())
            .expect("Failed to get balance");

        // Create a test transaction to calculate fees
        let message = Message::new_with_blockhash(
            &[transfer(&keypair.pubkey(), &to_pubkey, balance)],
            Some(&keypair.pubkey()),
            &recent_blockhash,
        );

        // Calculate exact fee rate to transfer entire SOL amount out of account minus fees
        let fee = rpc_client
            .get_fee_for_message(&message)
            .expect("Failed to get fee calculator");

        // Deduct fee from lamports amount and create a TX with correct balance
        let transaction = Transaction::new_signed_with_payer(
            &[transfer(&keypair.pubkey(), &to_pubkey, balance - fee)],
            Some(&keypair.pubkey()),
            &vec![&keypair],
            recent_blockhash,
        );

        // transfer 0.1 SOL from our dev wallet to our Turbin3 wallet address on the Solana devnet.
        // let transaction = Transaction::new_signed_with_payer(
        //     &[transfer(
        //         &keypair.pubkey(),
        //         &to_pubkey,
        //         100_000_000
        //     )],
        //     Some(&keypair.pubkey()),
        //     &vec![&keypair],
        //     recent_blockhash
        // );

        // Send the transaction
        let signature = rpc_client
            .send_and_confirm_transaction(&transaction)
            .expect("Failed to send transaction");

        // If everything went as planned, we'll print a link to the TX out to the terminal
        // Print our transaction out
        println!(
            "Success! Check out your TX here: https://explorer.solana.com/tx/{}/?cluster=devnet",
            signature
        );
    }

    #[test]
    fn enroll() {
        // Create a Solana devnet connection
        let rpc_client = RpcClient::new(RPC_URL);

        let signer = read_keypair_file("Turbin3-wallet.json").expect("Couldn't find wallet file");

        let prereq = TurbinePrereqProgram::derive_program_address(&[
            b"prereq",
            signer.pubkey().to_bytes().as_ref(),
        ]);

        // Define our instruction data
        let args = CompleteArgs {
            github: b"frikinomad".to_vec(),
        };

        // Get recent blockhash
        let blockhash = rpc_client
            .get_latest_blockhash()
            .expect("Failed to get recent blockhash");

        // Now we can invoke the "complete" function
        let transaction = TurbinePrereqProgram::complete(
            &[
                &signer.pubkey(),
                &prereq,
                &system_program::id()
            ],
            &args,
            Some(&signer.pubkey()),
            &[&signer],
            blockhash,
        );

        // Simulate transaction
        let simulation_result = rpc_client.simulate_transaction(&transaction);

        match simulation_result {
            Ok(result) => {
                if result.value.err.is_none() {
                    println!("Transaction simulation successful!");
                    assert!(true);
                } else {
                    println!("Transaction simulation failed");
                }
            }
            Err(e) => {
                println!("RPC Error: {:?}", e);
                assert!(false, "RPC request failed: {:?}", e);
            }
        }

        // Send the transaction
        let signature = rpc_client
            .send_and_confirm_transaction(&transaction)
            .expect("Failed to send transaction");

        // // Print our transaction out
        println!("Success! Check out your TX here: https://explorer.solana.com/tx/{}/?cluster=devnet", signature);
    }

}
