'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl, Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider, setProvider, Idl, BN, Wallet as anchorWallet, utils, Wallet } from "@coral-xyz/anchor";
import { 
  getAccount, 
  getAssociatedTokenAddress, 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TokenAccountNotFoundError,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';
import idl from '../utils/creator_dao.json'
import BottomNavbar from '../components/BottomNavbar';
import { Home, Users, Plus, Inbox, User, Hexagon, Check, ArrowUpRight, TrendingUp } from 'lucide-react';
import { connect } from 'http2';


const STAKING_THRESHOLD = 100; // Threshold for launching new token

export default function Dashboard() {
  const wallet = useWallet();
  const { publicKey, sendTransaction, connected } = useWallet();

  // const connection = new Connection(clusterApiUrl("devnet"), 'processed');
  const connection = new Connection("https://devnet.helius-rpc.com/?api-key=8d2772a2-a9f8-4847-b654-555ea45dddaf", 'processed');
  
  // UI State
  const [stakedAmount, setStakedAmount] = useState(0);
  const [stakeInput, setStakeInput] = useState(1);
  const [migrationActive, setMigrationActive] = useState(false);
  const [currentToken, setCurrentToken] = useState('NOVAA Token');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(true);
  
  // Program State
  const [program, setProgram] = useState(null);
  const [error, setError] = useState(null);
  const [amount, setAmount] = useState(0);
  const [isMember, setIsMember] = useState(null);
  
  // DAO State
  const [stakeAccounts, setStakeAccounts] = useState([]);
  const [totalBalance, setTotalBalance] = useState(0);   // complete DAO balance
  const [myStaked, setMyStaked] = useState(0);
  const [daoMember, setDaoMember] = useState(false);     // for current user is a member or not
  const [proposalNumber, setProposalNumber] = useState(null);
  const [novaaBalance, setNovaaBalance] = useState(0);

  // proposal
  const [gist, setGist] = useState("");
  const [id, setId] = useState(0);
  const [proposalType, setProposalType] = useState<'bounty' | 'executable' | 'vote'>('vote');
  const [proposalName, setProposalName] = useState('');
  const [bountyAddress, setBountyAddress] = useState('');
  const [threshold, setThreshold] = useState(null);
  const [proposalData, setProposalData] = useState(null);

  // this is for bounty type proposal
  const [recipientAddress, setRecipientAddress] = useState<string>('');
  const [bountyAmount, setBountyAmount] = useState<number>(0); 

  const [proposalSignature, setProposalSignature] = useState();

  const seedValue = new BN(1);

  // Initialize program when wallet connects
  useEffect(() => {
    wallet.autoConnect
    if(wallet)
      initializeProgram();
  }, [publicKey, connected]);

  useEffect(() => {
    const proposalFn = async () => { 
      const proposalData = await program.account.proposal.all();
      const proposalDataNames = await Promise.all(proposalData.map(async(item) => {
        return(item.account.name);
      }))
      setProposalData(proposalDataNames);
    }
    if(program && publicKey)
      proposalFn();
    else console.log("waiting for provider");
    
  }, [proposalSignature, publicKey])

    // Initialize Anchor program
  const initializeProgram = async () => {
    try {
      const provider = new AnchorProvider(
        connection,
        wallet,
        { commitment: 'processed' }
      );
      setProvider(provider);

      // You'll need to import your IDL
      const program = new Program(idl as Idl, provider);
      
      setProgram(program);      

      if(program) fetchStakeData(program);
      else console.log('waiting for provider');
    } catch (err) {
      setError("Failed to initialize program: " + err.message);
    }
  };

  async function getNovaaBalance(){

    const seed = seedValue;

    const [configPda] = await PublicKey.findProgramAddress(
      [Buffer.from("config"), seed.toArrayLike(Buffer, "le", 8)],
      program.programId
    );      
    const [mintPda] = await PublicKey.findProgramAddress(
      [Buffer.from("mint"), configPda.toBuffer()],
      program.programId
    );

    // Get all token accounts owned by the wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(publicKey),
      { programId: TOKEN_PROGRAM_ID }
    );
  
    // Extract balance info from each account
    const balances = tokenAccounts.value.map(account => {
      const parsedInfo = account.account.data.parsed.info;
      return {
        mint: parsedInfo.mint,
        tokenAddress: account.pubkey.toString(),
        balance: parsedInfo.tokenAmount.uiAmount,
        decimals: parsedInfo.tokenAmount.decimals
      };
    });

    const mintTokenBalance = balances.find(token => token.mint === mintPda.toBase58())?.balance;
    console.log(mintTokenBalance);

    setNovaaBalance(mintTokenBalance);
    
  }

  // fetch stake data for memebers
  const fetchStakeData = async (program) => {
    try {
      
        if(publicKey && program) await getNovaaBalance();
        
        const daoConfigData = await program.account.daoConfig.all();
        // it stores the proposal count
        await Promise.all(daoConfigData.map(async (item) => {
          setProposalNumber(item.account.proposalCount.toString());
        }));

        const proposalData = await program.account.proposal.all();
        const proposalDataNames = await Promise.all(proposalData.map(async(item) => {
          return(item.account.name);
        }))

        // console.log(proposalDataNames);
        setProposalData(proposalDataNames);

        const seed = seedValue; // DAO seed
        
        const [configPda] = await PublicKey.findProgramAddress(
          [Buffer.from("config"), seed.toArrayLike(Buffer, "le", 8)],
          program.programId
        );
        
        const stakeData = await program.account.stakeState.all();

        let totalStaked = 0;
        // Derive stake ATAs for each owner
        const stakeATAData = await Promise.all(stakeData.map(async (item) => {
          try{
            const ownerPublicKey = new PublicKey(item.account.owner);
          
            const [stakeAta] = await PublicKey.findProgramAddress(
              [Buffer.from("vault"), configPda.toBuffer(), ownerPublicKey.toBuffer()],
              program.programId
            );
            console.log("ata",stakeAta.toString());
            
            // Get token account info
            const tokenAccount = await getAccount(
                connection,
                stakeAta,
                'processed',
                TOKEN_PROGRAM_ID
            );
            
            const tokenBalance = tokenAccount.amount.toString();
            console.log("stake tokenBalance", tokenBalance);
            
            totalStaked = totalStaked + Number(tokenBalance);

            let isMember;
            if(Number(tokenBalance) > 0) {
              isMember=true;
            }

            return {
                owner: item.account.owner.toString(),
                stakeAta: stakeAta.toString(),
                tokenBalance,
                isMember
            };
          }catch(err){
            console.error("Error processing stake item:", err);
            return null; // Return something to keep Promise.all from failing
          }
        }));
      
        console.log("stakeATAData", stakeATAData);
        setStakeAccounts(stakeATAData);
        
        setTotalBalance(totalStaked);
        setStakedAmount(totalStaked); // Update UI staked amount with actual data

        if (!publicKey || stakeATAData.length === 0) return;
    
        for (let i = 0; i < stakeATAData.length; i++) {
          if (publicKey.toString() === stakeATAData[i].owner && 
            Number(stakeATAData[i].tokenBalance) > 0) {
              console.log("hi");
              setDaoMember(true);
              setMyStaked(stakeATAData[i].tokenBalance);
            break;
            }
          }
    } catch (error) {
      console.error("Error fetching stake data:", error);
    }
  };

  // Utility function to check or create Associated Token Account
  async function checkOrCreateATA(connection, publicKey, walletPublicKey, mint, instructions){
        const ATA = await getAssociatedTokenAddress(mint, publicKey);
        // TODO: console.log("ATA", ATA.toString());
      
    
        try{
        const accountInfo = await getAccount(connection, ATA);
        // TODO: console.log("ATA already exist ", accountInfo);
        return ATA;
        }catch(error){
        if(error instanceof TokenAccountNotFoundError){
            // TODO: console.log("ATA doesn't exist");
    
            instructions.push(
            createAssociatedTokenAccountInstruction(
                walletPublicKey,    // payer
                ATA,
                publicKey,          // owner
                mint,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
            )
            );
    
            return ATA;
        }else{
            console.error("Error in getting account");
            throw error;
        }
    }
  }

  // dummy transaction
  async function new_transaction(){

    // Create a dummy transaction (transfer 0 SOL to self)
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: publicKey,
        lamports: 0, // dummy transfer
      })
    );

    transaction.feePayer = publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    // Request user to sign & (optionally) send the transaction
    await sendTransaction(transaction, connection);
  }

  // Issue new tokens
  const issueTokens = async () => {
    setIsLoading(true);
    try {
      // Inputs
      const seed = seedValue;
      const programId = program.programId;
      console.log(programId.toString());
      
      // Derive config PDA
      const [configPda] = await PublicKey.findProgramAddress(
        [Buffer.from("config"), seed.toArrayLike(Buffer, "le", 8)],
        programId
      );
      
      // Derive other PDAs from configPda
      const [authPda] = await PublicKey.findProgramAddress(
        [Buffer.from("auth"), configPda.toBuffer()],
        programId
      );
      
      const [treasuryPda] = await PublicKey.findProgramAddress(
        [Buffer.from("treasury"), configPda.toBuffer()],
        programId
      );
      
      const [mintPda] = await PublicKey.findProgramAddress(
        [Buffer.from("mint"), configPda.toBuffer()],
        programId
      );

      const instructions = [];
      const initializerAta = await checkOrCreateATA(
        connection, 
        publicKey,
        publicKey,
        mintPda, 
        instructions);

      const instruction = await program.methods
        .issueTokens()
        .accounts({
          initializer: wallet.publicKey,
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
      
      instructions.push(instruction);

      const tx = new Transaction();
      instructions.forEach(instruction => tx.add(instruction));

      const { blockhash } = await connection.getLatestBlockhash('processed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;

      // Simulate transaction
      const simulationResult = await connection.simulateTransaction(tx);
      if (simulationResult.value.err) {
        console.error("Simulation failed:", simulationResult.value.err);
        console.error("Simulation failed:", simulationResult.value.logs);
      } else {
        console.log("Simulation successful.");
        const signature = await program.provider.sendAndConfirm(tx);
        console.log(signature);

        setNovaaBalance((prev) => (prev+1000));
      }
    } catch (error) {
      console.error("Error issuing tokens:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize stake account
  const initStake = async () => {
    setIsLoading(true);
    try {
      const seed = seedValue; // DAO seed
      const programId = program.programId;

      const [configPda] = await PublicKey.findProgramAddress(
        [Buffer.from("config"), seed.toArrayLike(Buffer, "le", 8)],
        programId
      );
      console.log(configPda.toString());
      
      
      const [mintPda] = await PublicKey.findProgramAddress(
        [Buffer.from("mint"), configPda.toBuffer()],
        programId
      );
      console.log(mintPda.toString());
      
      const [stakeAuthPda] = await PublicKey.findProgramAddress(
        [Buffer.from("auth"), configPda.toBuffer(), wallet.publicKey.toBuffer()],
        programId
      );
      console.log(stakeAuthPda.toString());
      
      const [stakeAta] = await PublicKey.findProgramAddress(
        [Buffer.from("vault"), configPda.toBuffer(), wallet.publicKey.toBuffer()],
        programId
      );
      console.log(stakeAta.toString());
      
      const [stakeStatePda] = await PublicKey.findProgramAddress(
        [Buffer.from("stake"), configPda.toBuffer(), wallet.publicKey.toBuffer()],
        programId
      );
      console.log(stakeStatePda.toString());
      
      const ownerAta = await getAssociatedTokenAddress(mintPda, wallet.publicKey);
      console.log(ownerAta.toString());

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
        .transaction();

      const { blockhash } = await connection.getLatestBlockhash('processed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;

      const simulationResult = await connection.simulateTransaction(tx);
      if (simulationResult.value.err) {
        console.error("Simulation failed:", simulationResult.value.err);
        console.error("Simulation failed:", simulationResult.value.logs);
      } else {
        console.log("Simulation successful.");
        const signature = await program.provider.sendAndConfirm(tx);
        console.log(signature);
      }
    } catch (error) {
      console.error("Error initializing stake:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Stake tokens
  const stakeTokens = async () => {
    setIsLoading(true);
    try {
      const seed = seedValue; // DAO seed
      const programId = program.programId;

      const [configPda] = await PublicKey.findProgramAddress(
        [Buffer.from("config"), seed.toArrayLike(Buffer, "le", 8)],
        programId
      );
      
      const [mintPda] = await PublicKey.findProgramAddress(
        [Buffer.from("mint"), configPda.toBuffer()],
        programId
      );
      
      const [stakeAuthPda] = await PublicKey.findProgramAddress(
        [Buffer.from("auth"), configPda.toBuffer(), wallet.publicKey.toBuffer()],
        programId
      );
      
      const [stakeAta] = await PublicKey.findProgramAddress(
        [Buffer.from("vault"), configPda.toBuffer(), wallet.publicKey.toBuffer()],
        programId
      );
      
      const [stakeStatePda] = await PublicKey.findProgramAddress(
        [Buffer.from("stake"), configPda.toBuffer(), wallet.publicKey.toBuffer()],
        programId
      );
      
      const ownerAta = await getAssociatedTokenAddress(mintPda, wallet.publicKey);
      
      const tx = await program.methods
        .stakeTokens(new BN(amount))
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
        .transaction();

      //  data + tx create -> tx send -> tx blockchain submit check

      const { blockhash } = await connection.getLatestBlockhash('processed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;

      const simulationResult = await connection.simulateTransaction(tx);
      if (simulationResult.value.err) {
        console.error("Simulation failed:", simulationResult.value.err);
      } else {
        console.log("Simulation successful.");
        const signature = await program.provider.sendAndConfirm(tx);
        console.log(signature);
        
        // TODO: Update UI staked amount (fetched)
        setStakedAmount(prev => {
          const newAmount = prev + amount;
          setIsMember(true);
          if (prev < STAKING_THRESHOLD && newAmount >= STAKING_THRESHOLD) {
            console.log("Threshold reached!");
          }
          return newAmount;
        });
      }
    } catch (error) {
      console.error("Error staking tokens:", error);
    } finally {
      setIsLoading(false);
    }
  };


  // Convert proposal type to the format expected by Anchor
  const getProposalTypeFormatted = () => {
    try {
      switch (proposalType) {
        case 'bounty':
          // Validate address
          if (!recipientAddress) {
            throw new Error('Recipient address is required for bounty proposals');
          }
          
          // Convert to own Token - which has 0 decimal
          const lamports = new BN(bountyAmount);
          
          // Create PublicKey from string
          let pubkey;
          try {
            pubkey = new PublicKey(recipientAddress);
          } catch (e) {
            throw new Error('Invalid recipient address');
          }
          
          // Return the properly formatted bounty variant
          return { 
            bounty: {
              0: pubkey,  // First tuple element is Pubkey
              1: lamports  // Second tuple element is u64 amount
            }
          };
        
        case 'executable':
          return { executable: {} };
        
        case 'vote':
          return { vote: {} };
        
        default:
          throw new Error(`Unknown proposal type: ${proposalType}`);
      }
    } catch (error) {
      console.error('Error formatting proposal type:', error);
      throw error;
    }
  };

  // proposals
  const createProposal = async () => {
    setIsLoading(true);
    try{
      const id = proposalNumber + 1;

      const seed = seedValue; // DAO seed

      // Derive PDAs
      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("config"), seed.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      
      const [proposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), configPda.toBuffer(), new BN(id).toArrayLike(Buffer, "le", 8)],
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

      const proposalTypeFormatted = getProposalTypeFormatted();
          
      const tx = await program.methods
        .createProposal(
          new BN(id),
          proposalName,
          gist,
          proposalTypeFormatted,
          new BN(threshold),
          new BN(64800), // 3 days expiry, i.e. amount as static
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
        .transaction();
        // .rpc();


        const { blockhash } = await connection.getLatestBlockhash('processed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = wallet.publicKey;

        // const simulationResult = await connection.simulateTransaction(tx);
        // if (simulationResult.value.err) {
        //   console.error("Simulation failed:", simulationResult.value.err);
        //   console.log("Simulation logs:", simulationResult.value.logs); // More detailed logs
        // } else {
        //   console.log("Simulation successful.");
        //   const signature = await program.provider.sendAndConfirm(tx);
        //   console.log(signature);
        // }
        await new_transaction();
        setIsLoading(false); 
        setSuccess(true);
        
      } catch (error) {
        console.error("Error staking tokens:", error);
      } finally {
        setIsLoading(false);
      }

  };

  // Simulate staking tokens for UI demo
  const handleStake = async () => {
    setIsLoading(true);
    
    // TODO:
    new_transaction();

    // Simulate transaction processing
    setTimeout(() => {
      setStakedAmount(prevAmount => {
        const newAmount = prevAmount + parseInt(String(stakeInput));
        // Check if we've hit the threshold
        if (prevAmount < STAKING_THRESHOLD && newAmount >= STAKING_THRESHOLD) {
          console.log("Threshold reached!");
        }
        return newAmount;
      });
      setIsLoading(false);
    }, 1000);
  };

  const handleLaunchNewToken = async() => {
    setIsLoading(true);

    // Create a dummy transaction (transfer 0 SOL to self)
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: publicKey,
        lamports: 0, // dummy transfer
      })
    );

    transaction.feePayer = publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    // Request user to sign & (optionally) send the transaction
    await sendTransaction(transaction, connection);

    
    // Simulate the token creation process
    setTimeout(() => {
      setMigrationActive(true);
      setCurrentToken('creator Token');
      setIsLoading(false);
    }, 2000);
  };

  const handleReset = () => {
    setStakedAmount(0);
    setMigrationActive(false);
    setCurrentToken('NOVAA Token');
  };

  return (
    <div className="app bg-white"> {/* Changed from dark to white background */}
      <div className="container bg-white"> {/* Ensure container is white */}
        {/* DAO Header */}
        <div className="flex flex-col items-center pt-6 pb-4">
          <div className="flex items-center space-x-2 mb-4">
            <span className={`text-sm ${isDemoMode ? 'font-bold text-yellow-600' : 'text-gray-500'}`}>
              Demo Mode
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={isDemoMode}
                onChange={() => setIsDemoMode(isDemoMode)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
            </label>
          </div>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-pink-400">
            NOVAA Dashboard
          </h1>
          <p className="text-gray-600 text-sm mt-1">Manage your DAO tokens and proposals</p> {/* Softer gray */}
        </div>
  
        <div className="px-4 py-2 max-w-md mx-auto">
          {/* Member status */}
          <div className="mb-5">
            <div className="w-full flex justify-center">
              <WalletMultiButton />
            </div>
            <br />
            <div className="flex gap-3">
              {publicKey &&
                <button className="bg-gradient-to-r from-purple-400 to-pink-400 text-white font-medium py-3 px-5 rounded-xl flex-1 shadow-md transition-transform hover:scale-105">
                  NOVAA Token balance: {novaaBalance}
                </button>
              }
            </div>
              <br />
            {daoMember ? (
              <div className="flex gap-3">
                <button className="bg-gradient-to-r from-purple-400 to-pink-400 text-white font-medium py-3 px-5 rounded-xl flex-1 shadow-md transition-transform hover:scale-105">
                  MEMBER
                </button>
                <button className="bg-gradient-to-r from-blue-400 to-cyan-400 text-white font-medium py-3 px-5 rounded-xl flex-1 shadow-md transition-transform hover:scale-105">
                  My Staked: {myStaked}
                </button>
              </div>
            ) : (
              <button className="bg-gray-100 text-gray-600 font-medium py-3 px-5 rounded-xl w-full shadow-sm">
                Not a MEMBER
              </button>
            )}
          </div>
  
          {/* Token Status Card */}
          <div className="bg-white p-4 rounded-xl shadow-md mb-5 border border-gray-200"> {/* White card with light border */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Creator DAO</h2> {/* Darker text for contrast */}
              {migrationActive && (
                <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full flex items-center">
                  <Check className="h-3 w-3 mr-1" /> Migrated
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1 mt-2 text-sm text-gray-700"> {/* Softer text */}
              <div className="flex items-center">
                <p className='glow-frills'>Stake to Become a Member 💥💥💥</p>
              </div>
              <br />
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${migrationActive ? 'bg-green-400' : 'bg-blue-400'}`} />
                <p>Staking with {currentToken}</p>
                {migrationActive && (
                  <span className="ml-auto flex items-center text-green-500 text-xs">
                    Active <ArrowUpRight className="h-3 w-3 ml-1" />
                  </span>
                )}
              </div>
            </div>
          </div>
  
          {/* Staking Card */}
          <div className="bg-white p-4 rounded-xl shadow-md mb-5 border border-gray-200"> {/* White card */}
            <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
              <TrendingUp className="h-4 w-4 mr-2 text-blue-500" />
              Staking Progress
            </h2>
  
            {/* Staking Interface */}
            <div className="flex flex-col gap-4">
              {/* Header */}
              <h2 className="text-sm font-medium text-gray-600 glow-frills">Stake Tokens</h2> {/* Softer gray */}
  
              {/* Input and Stake Button */}
              {/* TODO: enable this */}
              {/* <div className="flex gap-2">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="Enter Amount"
                  className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  onClick={stakeTokens}
                  disabled={isLoading || amount <= 0}
                  className="rounded-lg bg-blue-500 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Staking
                    </div>
                  ) : (
                    "Stake"
                  )}
                </button>
              </div> */}
  
              {/* Progress Bar */}
              <div className="w-full">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-gray-500">Progress</span>
                  <span className="text-gray-600">
                    {stakedAmount}/{STAKING_THRESHOLD}
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-400 transition-all duration-700 ease-out"
                    style={{ width: `${Math.min(100, (stakedAmount / STAKING_THRESHOLD) * 100)}%` }}
                  ></div>
                </div>
              </div>
  
              {/* Quick Actions */}
              <div className="flex gap-2">
                <button
                  onClick={issueTokens}
                  disabled={isLoading}
                  className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
                >
                  {isLoading ? "Processing..." : "Issue Tokens"}
                </button>
                <button
                  onClick={initStake}
                  disabled={isLoading}
                  className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
                >
                  {isLoading ? "Processing..." : "Init Stake"}
                </button>
              </div>
            </div>
  
            {/* Members list */}
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-600 flex items-center mb-2">
                <Users className="h-4 w-4 mr-1 text-blue-500" /> Members
              </h3>
              <div className="bg-gray-50 rounded-lg p-2 space-y-1">
              {[
                ...new Map(stakeAccounts.map(item => [item.owner, item])).values()
              ].map((account, index) => (
                <div key={index} className="text-sm text-gray-600 flex items-center p-1.5 rounded hover:bg-gray-100">
                  {account.owner.slice(0, 30)}.....
                </div>
              ))}
              </div>
            </div>
  
            {/* Staking input for original tokens */}
            {!migrationActive && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Stake Original Tokens</h3>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={stakeInput}
                    onChange={(e) => setStakeInput(Number(e.target.value))}
                    className="bg-gray-50 border border-gray-300 rounded-lg py-2 px-3 flex-1 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Amount"
                  />
                  <button
                    onClick={handleStake}
                    disabled={isLoading || stakeInput <= 0}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Stake
                  </button>
                </div>
              </div>
            )}
  
            {/* Launch new token button */}
            {stakedAmount >= STAKING_THRESHOLD && !migrationActive && (
              <button
                onClick={handleLaunchNewToken}
                disabled={isLoading}
                className="mt-5 bg-gradient-to-r from-green-400 to-emerald-300 text-white px-6 py-3 rounded-xl font-bold hover:from-green-500 hover:to-emerald-400 disabled:opacity-50 transition-all shadow-md w-full"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Launching...
                  </div>
                ) : 'Launch New DAO Token!'}
              </button>
            )}
          </div>
  
          {/* Proposal Section */}
          {!migrationActive && (
            <div className="bg-white p-4 rounded-xl shadow-md mb-5 border border-gray-200">
              {proposalData && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">Active Proposals</h2>
                  <div className="space-y-2 mb-4">
                    {proposalData.map((proposal, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                        <span className="text-gray-700">{proposal}</span>
                        <button className="bg-blue-500 text-white text-sm px-3 py-1 rounded-lg hover:bg-blue-600">
                          Vote
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
  
              {/* Create Proposal Section */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Create a Proposal</h2>
                <div className="flex flex-col space-y-3 mb-2">
                  <div className="bg-white p-3 rounded-lg">
                    <input
                      type="text"
                      value={proposalName}
                      onChange={(e) => setProposalName(e.target.value)}
                      placeholder="Proposal name"
                      className="w-full p-2 border border-gray-300 rounded bg-white text-gray-800 placeholder-gray-500"
                    />
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <select
                      value={proposalType}
                      onChange={(e) => setProposalType(e.target.value as 'bounty' | 'executable' | 'vote')}
                      className="w-full p-2 border border-gray-300 rounded bg-white text-gray-800"
                    >
                      <option value="" disabled hidden>Select proposal type</option>
                      <option value="vote">Vote</option>
                      <option value="bounty">Bounty</option>
                      <option value="executable">Executable</option>
                    </select>
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <input
                      type="number"
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                      placeholder="Threshold for passing"
                      className="w-full p-2 border border-gray-300 rounded bg-white text-gray-800 placeholder-gray-500"
                    />
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <textarea
                      value={gist}
                      onChange={(e) => setGist(e.target.value)}
                      placeholder="Proposal Description"
                      className="w-full p-2 border border-gray-300 rounded bg-white text-gray-800 placeholder-gray-500 h-24"
                    />
                  </div>
  
                  {proposalType === 'bounty' && (
                    <>
                      <div className="bg-white p-3 rounded-lg">
                        <input
                          type="text"
                          value={recipientAddress}
                          onChange={(e) => setRecipientAddress(e.target.value)}
                          placeholder="Recipient Address"
                          className="w-full p-2 border border-gray-300 rounded bg-white text-gray-800 placeholder-gray-500"
                        />
                      </div>
                      <div className="bg-white p-3 rounded-lg">
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={bountyAmount}
                            onChange={(e) => setBountyAmount(parseFloat(e.target.value))}
                            placeholder="Bounty Amount"
                            className="w-full p-2 pl-8 border border-gray-300 rounded bg-white text-gray-800 placeholder-gray-500"
                          />
                          <span className="absolute left-3 top-2 text-gray-500">◎</span>
                        </div>
                      </div>
                    </>
                  )}
  
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={createProposal}
                      disabled={isLoading}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {isLoading ? 'Processing...' : 'Create Proposal'}
                    </button>
                  </div>

                  {success && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-4 text-sm">
                      Proposal Created successfully!
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
  
          {/* Migration Section */}
          {migrationActive && (
            <div className="bg-white p-4 rounded-xl shadow-md mb-5 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Migration Successful!</h2>
              <div className="bg-green-100/30 border-l-4 border-green-400 p-3 mb-4 rounded-r-lg">
                <p className="text-green-600">Your DAO is now operating with the new token.</p>
              </div>
  
              <p className="text-gray-600 mb-4">Users can now stake with your new token and participate in governance.</p>
  
              <button
                className="bg-gradient-to-r from-green-400 to-emerald-300 text-white px-4 py-2 rounded-lg w-full transition-all hover:from-green-500 hover:to-emerald-400"
                onClick={() => alert("Staking with new token would happen here!")}
              >
                Stake with New Token
              </button>
            </div>
          )}
        </div>
        <BottomNavbar className="bottom-navbar" />
      </div>
    </div>
  );
}