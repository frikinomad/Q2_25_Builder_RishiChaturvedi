'use client';

import React, {useState, useEffect} from 'react';
import { useRouter } from 'next/navigation';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react';
import idl from '../utils/creator_dao.json'
import { clusterApiUrl, Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider, setProvider, Idl, BN, Wallet as anchorWallet, utils, Wallet } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, } from '@solana/spl-token';
import BottomNavbar from '../components/BottomNavbar';


const InitializeDAO = () => {


    const router = useRouter();

    const wallet = useAnchorWallet();
    const { publicKey, sendTransaction } = useWallet();
    const [program, setProgram] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [initDaoSignature, setInitDaoSignature] = useState(null);
    const [signature, setSignature] = useState(null);
    const [isDemoMode, setIsDemoMode] = useState(true);

    // Form state
    const [seedValue, setSeedValue] = useState(3);
    const [issuePrice, setIssuePrice] = useState(1); // 1 SOL
    const [issueAmount, setIssueAmount] = useState(1000); // Total tokens
    const [proposalFee, setProposalFee] = useState(0.01); // 0.01 SOL
    const [maxSupply, setMaxSupply] = useState(10000); // Max tokens
    const [minQuorum, setMinQuorum] = useState(100); // Min votes
    const [maxExpiry, setMaxExpiry] = useState(7); // Days
    
    // TODO: use wallet context connection, const connection = new Connection(clusterApiUrl('localnet'), 'confirmed');
    const connection = new Connection(clusterApiUrl('devnet'), {commitment: 'processed'});

    useEffect(() => {
      if (wallet) {
        initializeProgram();
      }
    }, [publicKey]);
    
    const initializeProgram = async () => {
        try {
            const provider = new AnchorProvider(
                connection,
                wallet,
                { commitment: 'processed' }
            );
            setProvider(provider);
            
            // You'll need to import your IDL
            const program = new Program(idl, provider);
            setProgram(program);          
        } catch (err) {
            setError("Failed to initialize program: " + err.message);
        }
    };

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
    

    const initDao = async () => {

        const seed = new BN(seedValue); // example seed
        const issuePrice = new BN(1_000_000); // 1 SOL = 1e9 lamports
        const issueAmount = new BN(1000); // total tokens to issue
        const proposalFee = new BN(10_000_000); // 0.01 SOL fee
        const maxSupply = new BN(10_000); // max tokens
        const minQuorum = new BN(100); // minimum votes
        const maxExpiry = new BN(7 * 24 * 60 * 60); // 7 days in seconds

        const [configPda, _configBump] = await PublicKey.findProgramAddress(
            [Buffer.from('config'), seed.toArrayLike(Buffer, 'le', 8)],
            program.programId
        ); 
        
        const [authPda, _authBump] = await PublicKey.findProgramAddress(
        [Buffer.from('auth'), configPda.toBuffer()],
        program.programId
        );
    
        const [treasuryPda, _treasuryBump] = await PublicKey.findProgramAddress(
        [Buffer.from('treasury'), configPda.toBuffer()],
        program.programId
        );
    
        const [mintPda, _mintBump] = await PublicKey.findProgramAddress(
        [Buffer.from('mint'), configPda.toBuffer()],
        program.programId
        );
    
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
        .transaction()
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
  
        //   setSuccess(true);
        //   // Redirect after success
        //   // setTimeout(() => router.push('/dashboard'), 2000);
        // }       

        await new_transaction();
        setIsLoading(false); 
        setSuccess(true);

    };

    return (
      <div className="app bg-white">
        <div className="container bg-white">
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
              Create Your DAO
            </h1>
            <p className="text-sm-600 font-medium text-gray-600 glow-frills">Become a Creator</p>
            <br />
            <div className="w-full flex justify-center">
              <WalletMultiButton />
            </div>

          </div>
          
          <div className="px-4 py-2 max-w-md mx-auto">
            {/* Status Messages */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
                {error}
              </div>
            )}

            
            {/* Config Card */}
            <div className="bg-white p-4 rounded-xl shadow-md mb-5 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">DAO Parameters</h2>
              
              <div className="space-y-3">
                {/* Seed */}
                {/* <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seed</label>
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div> */}
                
                {/* DAO Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DAO Name</label>
                  <input
                    type="text"
                    placeholder="DAO name"
                    // onChange={(e) => setIssuePrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                {/* Issue Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Issue Price (SOL)</label>
                  <input
                    type="number"
                    value={issuePrice}
                    onChange={(e) => setIssuePrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                
                {/* Issue Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Issue Amount (tokens)</label>
                  <input
                    type="number"
                    value={issueAmount}
                    onChange={(e) => setIssueAmount(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>
            </div>
            
            {/* Advanced Settings Card */}
            <div className="bg-white p-4 rounded-xl shadow-md mb-5 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Advanced Settings</h2>
              
              <div className="space-y-3">
                {/* Proposal Fee */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proposal Fee (SOL)</label>
                  <input
                    type="number"
                    value={proposalFee}
                    onChange={(e) => setProposalFee(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                
                {/* Max Supply */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Supply (tokens)</label>
                  <input
                    type="number"
                    value={maxSupply}
                    onChange={(e) => setMaxSupply(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                
                {/* Min Quorum */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Quorum (votes)</label>
                  <input
                    type="number"
                    value={minQuorum}
                    onChange={(e) => setMinQuorum(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                
                {/* Max Expiry */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Expiry (days)</label>
                  <input
                    type="number"
                    value={maxExpiry}
                    onChange={(e) => setMaxExpiry(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>
            </div>
            
            {/* Initialize Button */}
            <button
              onClick={initDao}
              disabled={isLoading || !program}
              className="bg-gradient-to-r from-blue-500 to-pink-400 text-white font-medium py-3 px-5 rounded-xl w-full shadow-md transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 mb-6"
            >
              {success ? (
                // <div className="flex items-center justify-center">
                //   <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                //   Initializing DAO
                // </div>
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-4 text-sm">
                  DAO initialized successfully!
                </div>
              ) : (
                "Initialize DAO"
              )}
            </button>
          </div>
          <BottomNavbar className="bottom-navbar" />
        </div>
      </div>
    );
};

export default InitializeDAO;