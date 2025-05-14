import React from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { clusterApiUrl, Connection, PublicKey } from '@solana/web3.js'
import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, setProvider, Idl, BN } from "@coral-xyz/anchor";
import idl from '../util/creator_dao.json'

const InitializeDAO = () => {

    const wallet = useAnchorWallet();
    const { publicKey } = useWallet();
    const {connection} = useConnection();
    const [program, setProgram] = useState(null);
    
    // TODO: use wallet context connection, const connection = new Connection(clusterApiUrl('localnet'), 'confirmed');

    useEffect(() => {
        if (wallet.connected) {
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
            
            await fetchListings();
            await fetchRented();            
        } catch (err) {
            setError("Failed to initialize program: " + err.message);
        }
    };

    const initDao = async () => {

        const seed = new anchor.BN(1); // example seed
        const issuePrice = new anchor.BN(1_000_000); // 1 SOL = 1e9 lamports
        const issueAmount = new anchor.BN(1000); // total tokens to issue
        const proposalFee = new anchor.BN(10_000_000); // 0.01 SOL fee
        const maxSupply = new anchor.BN(10_000); // max tokens
        const minQuorum = new anchor.BN(100); // minimum votes
        const maxExpiry = new anchor.BN(7 * 24 * 60 * 60); // 7 days in seconds

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
    
        await program.methods
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
    };

    return(
        <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Initialize DAO</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            DAO initialized successfully!
          </div>
        )}
        
        <div className="space-y-4">
          {/* Seed */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seed</label>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          
          {/* Issue Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Issue Price (SOL)</label>
            <input
              type="number"
              value={issuePrice}
              onChange={(e) => setIssuePrice(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          
          {/* Issue Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Issue Amount (tokens)</label>
            <input
              type="number"
              value={issueAmount}
              onChange={(e) => setIssueAmount(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          
          {/* Proposal Fee */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Proposal Fee (SOL)</label>
            <input
              type="number"
              value={proposalFee}
              onChange={(e) => setProposalFee(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          
          {/* Max Supply */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Supply (tokens)</label>
            <input
              type="number"
              value={maxSupply}
              onChange={(e) => setMaxSupply(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          
          {/* Min Quorum */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Quorum (votes)</label>
            <input
              type="number"
              value={minQuorum}
              onChange={(e) => setMinQuorum(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          
          {/* Max Expiry */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Expiry (days)</label>
            <input
              type="number"
              value={maxExpiry}
              onChange={(e) => setMaxExpiry(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          
          {/* Initialize Button */}
          <div className="flex gap-2 mt-6">
            <button
              onClick={initDao}
              disabled={isLoading || !program}
              className="w-full rounded-lg bg-blue-500 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Initializing
                </div>
              ) : (
                "Initialize DAO"
              )}
            </button>
          </div>
        </div>
      </div>
    );
};

export default InitializeDAO;