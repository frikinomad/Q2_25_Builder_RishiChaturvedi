import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CreatorDao } from "../target/types/creator_dao";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getMint,
  createAssociatedTokenAccountInstruction,
  getAccount,
  createMintToInstruction,
 } from "@solana/spl-token";
import { assert } from "chai";
import BN from "bn.js";

describe("creator-dao", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.CreatorDao as Program<CreatorDao>;
  const wallet = provider.wallet;

  const seedValue = 1; // customize if needed
  const seed = new BN(seedValue);
  const issuePrice = new BN(1_000_000); // 0.001 SOL
  const issueAmount = new BN(1000);
  const proposalFee = new BN(10_000_000); // 0.01 SOL
  const maxSupply = new BN(10_000);
  const minQuorum = new BN(100);
  const maxExpiry = new BN(7 * 24 * 60 * 60); // 7 days

  let configPda: PublicKey;
  let authPda: PublicKey;
  let treasuryPda: PublicKey;
  let mintPda: PublicKey;
  let stakeAuthPda: PublicKey, stakeAta: PublicKey, stakeStatePda: PublicKey;
  let ownerAta: PublicKey;

  before(async () => {
    [configPda] = await PublicKey.findProgramAddress(
      [Buffer.from("config"), seed.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    [authPda] = await PublicKey.findProgramAddress(
      [Buffer.from("auth"), configPda.toBuffer()],
      program.programId
    );

    [treasuryPda] = await PublicKey.findProgramAddress(
      [Buffer.from("treasury"), configPda.toBuffer()],
      program.programId
    );

    [mintPda] = await PublicKey.findProgramAddress(
      [Buffer.from("mint"), configPda.toBuffer()],
      program.programId
    );

    [stakeAuthPda] = await PublicKey.findProgramAddress(
      [Buffer.from("auth"), configPda.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    );
    [stakeAta] = await PublicKey.findProgramAddress(
      [Buffer.from("vault"), configPda.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    );
    [stakeStatePda] = await PublicKey.findProgramAddress(
      [Buffer.from("stake"), configPda.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    );

    ownerAta = await getAssociatedTokenAddress(mintPda, wallet.publicKey);
  });

  it("Initializes the DAO config correctly", async () => {
    const tx = await program.methods
      .initialize(
        seed,
        issuePrice,
        issueAmount,
        proposalFee,
        maxSupply,
        minQuorum,
        maxExpiry
      )
      .accounts({
        initializer: wallet.publicKey,
        config: configPda,
        auth: authPda,
        treasury: treasuryPda,
        mint: mintPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Transaction signature:", tx);

    // Optionally, fetch and assert the config state
    const configAccount = await program.account.daoConfig.fetch(configPda);

    assert.ok(configAccount.issuePrice.eq(issuePrice));
    assert.ok(configAccount.issueAmount.eq(issueAmount));
    assert.ok(configAccount.proposalFee.eq(proposalFee));
    assert.ok(configAccount.maxSupply.eq(maxSupply));
    assert.ok(configAccount.minQuorum.eq(minQuorum));
    assert.ok(configAccount.maxExpiry.eq(maxExpiry));

  });

  it("Issues tokens to the initializer's ATA", async () => {
    const initializer = wallet.publicKey;

    const initializerAta = await getAssociatedTokenAddress(mintPda, initializer);

    // Add instruction to create ATA if missing
    const ataIx = await program.provider.connection.getAccountInfo(initializerAta)
      ? undefined
      : createAssociatedTokenAccountInstruction(
          initializer,
          initializerAta,
          initializer,
          mintPda
        );

    const tx = new Transaction();

    if (ataIx) {
      tx.add(ataIx);
    }

    const issueIx = await program.methods
      .issueTokens()
      .accounts({
        initializer,
        initializerAta,
        auth: authPda,
        treasury: treasuryPda,
        mint: mintPda,
        config: configPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    tx.add(issueIx);

    const sig = await provider.sendAndConfirm(tx);
    console.log("Issue tokens tx:", sig);

    const ataAccount = await provider.connection.getTokenAccountBalance(initializerAta);
    console.log("ATA Balance:", ataAccount.value.uiAmountString);

    assert.ok(Number(ataAccount.value.amount) > 0, "Tokens were not issued");
  });

  it("Initializes stake account", async () => {
    const tx = await program.methods
      .initStake()
      .accounts({
        owner: wallet.publicKey,
        ownerAta,
        stakeAta,
        stakeAuth: stakeAuthPda,
        mint: mintPda,
        stakeState: stakeStatePda,
        config: configPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Initialized stake:", tx);
  });

  it("stakes tokens successfully", async () => {
    const ownerBefore = await getAccount(provider.connection, ownerAta);
    const vaultBefore = await getAccount(provider.connection, stakeAta);

    const stakeAmount = new anchor.BN(10);

    console.log(ownerAta.toString());
    console.log(stakeAta.toString());

    // Simulate staking tokens
    const tx = await program.methods
      .stakeTokens(stakeAmount)
      .accounts({
        owner: wallet.publicKey,
        ownerAta,
        stakeAta,
        stakeAuth: stakeAuthPda,
        mint: mintPda,
        stakeState: stakeStatePda,
        config: configPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Transaction signature stake:", tx);

    const ownerAfter = await getAccount(provider.connection, ownerAta);
    const vaultAfter = await getAccount(provider.connection, stakeAta);

    // Convert the amounts to BigInt for comparison
    const expectedOwnerAmount = new anchor.BN(ownerBefore.amount.toString()).sub(stakeAmount);
    const expectedVaultAmount = new anchor.BN(vaultBefore.amount.toString()).add(stakeAmount);

    assert.equal(
      ownerAfter.amount.toString(),
      expectedOwnerAmount.toString(),
      "Owner's ATA should be debited"
    );
    assert.equal(
      vaultAfter.amount.toString(),
      expectedVaultAmount.toString(),
      "Vault should be credited"
    );
  });

  it("creates proposal successfully", async () => {
    const id = 1;

    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), seed.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    // Use the correct proposal PDA seed format
    const [proposalPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("proposal"),
        configPda.toBuffer(),
        new BN(id).toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    const [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), configPda.toBuffer()],
      program.programId
    );

    const [stakeStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("stake"), configPda.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    );

    console.log(proposalPda.toString());
    
    const proposalTypeFormatted = {vote: {}}; // Representing `Vote` ProposalType
    const threshold = 1000; // Example threshold value
    const gist = "vote proposal"; // Example description

    // Create proposal
    const tx = await program.methods
      .createProposal(
        new BN(id),
        'proposalName',
        gist,
        proposalTypeFormatted,
        new BN(threshold),
        new BN(64800), // 3 days expiry
        Buffer.alloc(0)
      )
      .accounts({
        owner: wallet.publicKey,
        proposal: proposalPda,
        config: configPda,
        treasury: treasuryPda,
        stakeState: stakeStatePda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Transaction signature create vote proposal:", tx);

    // Capture the created proposal
    const proposalAfter = await program.account.proposal.fetch(proposalPda);
    console.log("hmm", proposalAfter.proposal.toString());
  
    // Validate the threshold and gist
    assert.equal(
      proposalAfter.quorum.toString(),
      threshold.toString(),
      "Proposal threshold should match"
    );

    assert.equal(
      proposalAfter.gist,
      gist,
      "Proposal gist should match"
    );
  });

});
