// declare_id!("89tL9Ht9DvKaKjoAovBAaACsD9kL9VCDx9vzFbAuqsjD");

#![allow(unexpected_cfgs)]

use anchor_lang::{prelude::*, prelude::error_code, system_program::{Transfer, transfer}};
use anchor_spl::{token::{Token, TokenAccount, MintTo, mint_to, Mint}, associated_token::AssociatedToken};
// For stake & unstake
use anchor_spl::token::{Transfer as TransferSpl, transfer as transfer_spl};


declare_id!("89tL9Ht9DvKaKjoAovBAaACsD9kL9VCDx9vzFbAuqsjD");

pub const PUBKEY_L: usize = 32;
pub const ENUM_L: usize = 1;
pub const U64_L: usize = 8;
pub const U16_L: usize = 2;
pub const BOOL_L: usize = 1;
pub const OPTION_L: usize = 1;
pub const U8_L: usize = 1;

#[program]
pub mod creator_dao {

    use super::*;

    // Instantiate a new DAO using the DAO2023 program
    pub fn initialize(
        ctx: Context<Initialize>,
        seed: u64,
        issue_price: u64,
        issue_amount: u64,
        proposal_fee: u64,
        max_supply: u64,
        min_quorum: u64,
        max_expiry: u64
    ) -> Result<()> {
        
        let auth_bump = ctx.bumps.auth;
        let config_bump = ctx.bumps.config;
        let mint_bump = ctx.bumps.mint;
        let treasury_bump = ctx.bumps.treasury;

        ctx.accounts.config.init(
            seed,
            issue_price,
            issue_amount,
            proposal_fee,
            max_supply,
            min_quorum,
            max_expiry,
            auth_bump,
            config_bump,
            mint_bump,
            treasury_bump,
        )
    }


    pub fn issue_tokens(ctx: Context<IssueTokens>) -> Result<()> {
        ctx.accounts.deposit_sol()?;
        ctx.accounts.issue_tokens()
    }

    // Initialize a stake account for adding DAO tokens
    pub fn init_stake(ctx: Context<InitializeStake>) -> Result<()> {

        ctx.accounts.stake_state.init(
            ctx.accounts.owner.key(),
            ctx.bumps.stake_state,
            ctx.bumps.stake_ata,
            ctx.bumps.stake_auth
        )
    }

    // Stake DAO tokens
    pub fn stake_tokens(ctx: Context<Stake>, amount: u64) -> Result<()> {
        ctx.accounts.stake_state.stake(amount)?;

        let accounts = TransferSpl {
            from: ctx.accounts.owner_ata.to_account_info(),
            to: ctx.accounts.stake_ata.to_account_info(),
            authority: ctx.accounts.owner.to_account_info()
        };

        let ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            accounts
        );
        transfer_spl(ctx, amount)
    }

    // Stake DAO tokens
    pub fn unstake_tokens(ctx: Context<Stake>, amount: u64) -> Result<()> {
        ctx.accounts.stake_state.unstake(amount)?;

        let accounts = TransferSpl {
            from: ctx.accounts.stake_ata.to_account_info(),
            to: ctx.accounts.owner_ata.to_account_info(),
            authority: ctx.accounts.auth.to_account_info()
        };

        let seeds = &[
            &b"auth"[..],
            &ctx.accounts.config.key().to_bytes()[..],
            &ctx.accounts.auth.key().to_bytes()[..],
            &[ctx.accounts.stake_state.auth_bump],
        ];

        let signer_seeds = &[&seeds[..]];

        let ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            accounts,
            signer_seeds
        );

        transfer_spl(ctx, amount)
    }

    // Create a proposal
    pub fn create_proposal(
        ctx: Context<CreateProposal>, 
        id: u64, 
        name: String, 
        gist: String, 
        proposal: ProposalType, 
        threshold: u64, 
        amount: u64, 
        data: Vec<u8>
    ) -> Result<()> {

        // Pay a proposal fee to DAO treasury
        ctx.accounts.pay_proposal_fee()?;

        // Ensure user has actually got tokens staked and create a new proposal
        ctx.accounts.create_proposal(
            id, 
            name, 
            gist,
            proposal,
            threshold, 
            amount,
            ctx.bumps.proposal
        )
    }

    // Cleanup a proposal
    pub fn cleanup_proposal(
        ctx: Context<CleanupProposal>, 
    ) -> Result<()> {
        
        ctx.accounts.cleanup_proposal()
    }

     pub fn execute_proposal(
        ctx: Context<CleanupProposal>, 
    ) -> Result<()> {
        
        ctx.accounts.execute_proposal()
    }

    // Vote on a proposal
    pub fn vote(ctx: Context<Vote>, amount: u64) -> Result<()> {
        // Increment total number of votes in the proposal

        // Check proposal is open
        ctx.accounts.proposal.is_open()?;
        // Check proposal hasn't expired
        ctx.accounts.proposal.check_expiry()?;
        // Ensure vote amount > 0
        require!(amount > 0, DaoError::InvalidVoteAmount);
        // Add vote to proposal
        ctx.accounts.proposal.add_vote(amount)?;
        // Make sure user has staked
        ctx.accounts.stake_state.check_stake_amount(amount)?;
        // Add a vote account to the stake state
        ctx.accounts.stake_state.add_account()?;
        // Initialize vote
        ctx.accounts.vote.init(
            ctx.accounts.owner.key(),
            amount,
            ctx.bumps.vote
        )
    }

    // Close a voting position after a proposal has passed/expired
    pub fn cleanup_vote(ctx: Context<Unvote>) -> Result<()> {
        // Decrement votes for user
        
        if ctx.accounts.proposal.is_open().is_ok() && ctx.accounts.proposal.check_expiry().is_ok() {
            return err!(DaoError::InvalidProposalStatus);
        }
        // Remove a vote account to the stake state
        ctx.accounts.stake_state.remove_account()
    }

    // Close a voting position in an active proposal
    pub fn remove_vote(ctx: Context<Unvote>) -> Result<()> {
        // Decrement votes for user and proposal
        ctx.accounts.proposal.is_open()?;
        ctx.accounts.proposal.check_expiry()?;
        ctx.accounts.proposal.remove_vote(ctx.accounts.vote.amount)?;
        ctx.accounts.stake_state.remove_account()
    }
}


#[derive(Accounts)]
#[instruction(seed: u64)]
pub struct Initialize<'info> {
    #[account(mut)]
    initializer: Signer<'info>,

    #[account(
        init,
        payer = initializer,
        seeds=[b"config", seed.to_le_bytes().as_ref()],
        bump,
        space = 8 + DaoConfig::LEN
    )]
    config: Account<'info, DaoConfig>,

    #[account(
        seeds=[b"auth", config.key().as_ref()],
        bump
    )]
    ///CHECK: This is safe. It's just used to sign things
    auth: UncheckedAccount<'info>,
    #[account(
        seeds=[b"treasury", config.key().as_ref()],
        bump
    )]
    treasury: SystemAccount<'info>,
    #[account(
        init,
        payer = initializer,
        seeds = [b"mint", config.key().as_ref()],
        bump,
        mint::authority = auth,
        mint::decimals = 0
    )]
    mint: Account<'info, Mint>,
    
    token_program: Program<'info, Token>,
    system_program: Program<'info, System>
}


#[derive(Accounts)]
pub struct IssueTokens<'info> {
    #[account(mut)]
    initializer: Signer<'info>,

    #[account(
        mut,
        // init,
        // payer = initializer,
        associated_token::mint = mint,
        associated_token::authority = initializer
    )]
    initializer_ata: Account<'info, TokenAccount>,

    #[account(
        seeds=[b"auth", config.key().as_ref()],
        bump = config.auth_bump
    )]
    ///CHECK: This is safe. It's just used to sign things
    auth: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds=[b"treasury", config.key().as_ref()],
        bump = config.treasury_bump
    )]
    treasury: SystemAccount<'info>,
    #[account(
        mut,
        seeds=[b"mint", config.key().as_ref()],
        bump = config.mint_bump
    )]
    mint: Account<'info, Mint>,
    #[account(
        seeds=[b"config", config.seed.to_le_bytes().as_ref()],
        bump = config.config_bump
    )]
    config: Account<'info, DaoConfig>,
    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
    system_program: Program<'info, System>
}


impl<'info> IssueTokens<'info> {
    pub fn deposit_sol(
        &self
    ) -> Result<()> {
        let accounts = Transfer {
            from: self.initializer.to_account_info(),
            to: self.treasury.to_account_info()
        };

        let ctx = CpiContext::new(
            self.system_program.to_account_info(),
            accounts
        );

        transfer(ctx, self.config.issue_price)
    }

    pub fn issue_tokens(
        &self
    ) -> Result<()> {
        let accounts = MintTo {
            mint: self.mint.to_account_info(),
            to: self.initializer_ata.to_account_info(),
            authority: self.auth.to_account_info()
        };

        let seeds = &[
            &b"auth"[..],
            &self.config.key().to_bytes()[..],
            &[self.config.auth_bump],
        ];

        let signer_seeds = &[&seeds[..]];

        let ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            accounts,
            signer_seeds
        );

        mint_to(ctx, self.config.issue_amount)
    }
}


#[derive(Accounts)]
pub struct InitializeStake<'info> {
    #[account(mut)]
    owner: Signer<'info>,
    #[account(
        associated_token::mint = mint,
        associated_token::authority = owner
    )]
    owner_ata: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = owner,
        seeds = [b"vault", config.key().as_ref(), owner.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = stake_auth
    )]
    stake_ata: Account<'info, TokenAccount>,

    #[account(
        seeds=[b"auth", config.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    ///CHECK: This is safe. It's just used to sign things
    stake_auth: UncheckedAccount<'info>,

    #[account(
        seeds=[b"mint", config.key().as_ref()],
        bump = config.mint_bump
    )]
    mint: Account<'info, Mint>,

    #[account(
        init,
        payer = owner,
        seeds=[b"stake", config.key().as_ref(), owner.key().as_ref()],
        bump,
        space = StakeState::LEN
    )]
    stake_state: Account<'info, StakeState>,

    #[account(
        seeds=[b"config", config.seed.to_le_bytes().as_ref()],
        bump = config.config_bump
    )]
    config: Account<'info, DaoConfig>,
    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
    system_program: Program<'info, System>
}


#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    owner: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner
    )]
    owner_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault", config.key().as_ref(), owner.key().as_ref()],
        bump = stake_state.vault_bump,
        token::mint = mint,
        token::authority = auth
    )]
    stake_ata: Account<'info, TokenAccount>,

    #[account(
        seeds=[b"auth", config.key().as_ref(), owner.key().as_ref()],
        bump = stake_state.auth_bump
    )]
    ///CHECK: This is safe. It's just used to sign things
    auth: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds=[b"mint", config.key().as_ref()],
        bump = config.mint_bump
    )]
    mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds=[b"stake", config.key().as_ref(), owner.key().as_ref()],
        bump = stake_state.state_bump
    )]
    stake_state: Account<'info, StakeState>,

    #[account(
        seeds=[b"config", config.seed.to_le_bytes().as_ref()],
        bump = config.config_bump
    )]
    config: Account<'info, DaoConfig>,
    
    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
    system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct CreateProposal<'info> {
    #[account(mut)]
    owner: Signer<'info>,
    #[account(
        mut,
        seeds=[b"stake", config.key().as_ref(), owner.key().as_ref()],
        bump = stake_state.state_bump
    )]
    stake_state: Account<'info, StakeState>,
    #[account(
        init,
        payer = owner,
        seeds=[b"proposal", config.key().as_ref(), id.to_le_bytes().as_ref()],
        bump,
        space = Proposal::LEN
    )]
    proposal: Account<'info, Proposal>,
    #[account(
        mut,
        seeds=[b"treasury", config.key().as_ref()],
        bump = config.treasury_bump
    )]
    treasury: SystemAccount<'info>,
    #[account(
        seeds=[b"config", config.seed.to_le_bytes().as_ref()],
        bump = config.config_bump
    )]
    config: Account<'info, DaoConfig>,
    system_program: Program<'info, System>
}


impl<'info> CreateProposal<'info> {

    pub fn create_proposal(
        &mut self,
        id: u64,
        name: String,
        gist: String,
        proposal: ProposalType,
        quorum: u64,
        expiry: u64,
        bump: u8
    ) -> Result<()> {
        // Make sure user has staked
        // self.stake_state.check_stake()?;
        // Check ID and add proposal
        self.config.add_proposal(id)?;
        // Check minimum quorum
        self.config.check_min_quorum(quorum)?;
        // Check max expiry
        self.config.check_max_expiry(expiry)?;
        // Initialize the proposal
        self.proposal.init(
            id,
            name, // A proposal name
            gist, // 72 bytes (39 bytes + / + 32 byte ID)
            proposal,
            quorum,
            expiry,
            bump
        )
    }

    pub fn pay_proposal_fee(
        &mut self
    ) -> Result<()> {
        let accounts = Transfer {
            from: self.owner.to_account_info(),
            to: self.treasury.to_account_info(),
        };

        let ctx = CpiContext::new(
            self.system_program.to_account_info(),
            accounts
        );

        transfer(ctx, self.config.proposal_fee)
    }
}


#[derive(Accounts)]
pub struct CleanupProposal<'info> {
    #[account(mut)]
    initializer: Signer<'info>,
    
    #[account(mut)]
    ///CHECK: This is safe. It's just used to sign things
    payee: UncheckedAccount<'info>,
    #[account(
        mut,
        close = treasury,
        seeds=[b"proposal", config.key().as_ref(), proposal.id.to_le_bytes().as_ref()],
        bump = proposal.bump
    )]
    proposal: Account<'info, Proposal>,
    #[account(
        mut,
        seeds=[b"treasury", config.key().as_ref()],
        bump = config.treasury_bump
    )]
    treasury: SystemAccount<'info>,
    #[account(
        seeds=[b"config", config.seed.to_le_bytes().as_ref()],
        bump = config.config_bump
    )]
    config: Account<'info, DaoConfig>,
    system_program: Program<'info, System>
}


impl<'info> CleanupProposal<'info> {
    pub fn cleanup_proposal(
        &mut self
    ) -> Result<()> {
        // Try finalize
        self.proposal.try_finalize();
        self.proposal.is_failed()?;
        Ok(())
    }

    pub fn execute_proposal(
        &mut self
    ) -> Result<()> {
        // Try finalize proposal
        self.proposal.try_finalize();
        // Check if the status is successful
        self.proposal.is_succeeded()?;
        match self.proposal.proposal {
            ProposalType::Bounty(payee, payout) => self.payout_bounty(payee, payout),
            ProposalType::Executable => self.execute_tx(),
            ProposalType::Vote => self.finalize_vote(),
        }
    }

    pub fn finalize_vote(&self) -> Result<()> {
        msg!("Vote result: {} / {}", self.proposal.votes, self.proposal.quorum);
        msg!("Vote has {:?}", self.proposal.result);
        Ok(())
    }

    pub fn payout_bounty(
        &self,
        payee: Pubkey,
        payout: u64
    ) -> Result<()> {
        require_keys_eq!(self.payee.key(), payee);

        let accounts = Transfer {
            from: self.treasury.to_account_info(),
            to: self.payee.to_account_info()
        };

        let seeds = &[
            &b"auth"[..],
            &self.config.key().to_bytes()[..],
            &[self.config.auth_bump],
        ];

        let signer_seeds = &[&seeds[..]];

        let ctx = CpiContext::new_with_signer(
            self.system_program.to_account_info(),
            accounts,
            signer_seeds
        );

        transfer(ctx, payout)
    }

    pub fn execute_tx(
        &self
    ) -> Result<()> {
        // Instruction

        // Accounts

        // Signers
        
        Ok(())
    }
}


#[derive(Accounts)]
pub struct Vote<'info> {
    #[account(mut)]
    owner: Signer<'info>,
    #[account(
        mut,
        seeds=[b"stake", config.key().as_ref(), owner.key().as_ref()],
        bump = stake_state.state_bump
    )]
    stake_state: Account<'info, StakeState>,
    #[account(
        mut,
        seeds=[b"proposal", config.key().as_ref(), proposal.id.to_le_bytes().as_ref()],
        bump = proposal.bump,
    )]
    proposal: Account<'info, Proposal>,
    #[account(
        init,
        payer = owner,
        seeds=[b"vote", proposal.key().as_ref(), owner.key().as_ref()],
        bump,
        space = VoteState::LEN
    )]
    vote: Account<'info, VoteState>,
    #[account(
        seeds=[b"config", config.seed.to_le_bytes().as_ref()],
        bump = config.config_bump
    )]
    config: Account<'info, DaoConfig>,
    system_program: Program<'info, System>
}


#[account]
pub struct DaoConfig {
    pub seed: u64,
    pub issue_price: u64,
    pub issue_amount: u64,
    pub proposal_fee: u64,
    pub max_supply: u64,
    pub min_quorum: u64,
    pub max_expiry: u64,
    pub proposal_count: u64,
    pub auth_bump: u8,
    pub config_bump: u8,
    pub mint_bump: u8,
    pub treasury_bump: u8
}

impl DaoConfig {
    pub const LEN: usize = 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 1 + 1; // size of all fields

    pub fn init(
        &mut self,
        seed: u64,
        issue_price: u64,
        issue_amount: u64,
        proposal_fee: u64,
        max_supply: u64,
        min_quorum: u64,
        max_expiry: u64,
        auth_bump: u8,
        config_bump: u8,
        mint_bump: u8,
        treasury_bump: u8        
    ) -> Result<()> {
        self.seed = seed;
        self.issue_price = issue_price;
        self.issue_amount = issue_amount;
        self.proposal_fee = proposal_fee;
        self.max_supply = max_supply;
        self.min_quorum = min_quorum;
        self.max_expiry = max_expiry;
        self.proposal_count = 0;
        self.auth_bump = auth_bump;
        self.config_bump = config_bump;
        self.mint_bump = mint_bump;
        self.treasury_bump = treasury_bump;
        Ok(())
    }

    pub fn add_proposal(&mut self, id: u64) -> Result<()> {
        self.proposal_count = self.proposal_count.checked_add(1).ok_or(DaoError::Overflow)?;
        require!(self.proposal_count == id, DaoError::InvalidProposalSeed);
        Ok(())
    }

    pub fn check_min_quorum(&self, quorum: u64) -> Result<()> {
        require!(self.min_quorum <= quorum, DaoError::InvalidQuorum);
        Ok(())
    }

    pub fn check_max_expiry(&self, expiry: u64) -> Result<()> {
        require!(self.max_expiry >= expiry, DaoError::InvalidExpiry);
        Ok(())
    }
}



#[account]
pub struct Proposal {
    pub id: u64, // A unique ID. Can be sequential or random.
    pub name: String, // A proposal name
    pub gist: String, // 72 bytes (39 bytes + / + 32 char ID)
    pub proposal: ProposalType,
    pub result: ProposalStatus,
    pub quorum: u64,
    pub votes: u64,
    pub expiry: u64,
    pub bump: u8,
}

impl Proposal{
    // pub const LEN: usize = 8 + 32 + 72 + ENUM_L * 2 + U8_L * 2 + 3 * U64_L + U8_L;
    pub const LEN: usize = 8 + 36 + 76 + 1 + 1 + 8 + 8 + 8 + 1; // 147

    pub fn init(
        &mut self,
        id: u64,
        name: String,
        gist: String,
        proposal: ProposalType,
        quorum: u64,
        expiry: u64,
        bump: u8
    ) -> Result<()> {
        require!(name.len() < 33, DaoError::InvalidName);
        require!(gist.len() < 73, DaoError::InvalidGist);
        self.id = id;
        self.proposal = proposal;
        self.name = name;
        self.gist = gist;
        self.result = ProposalStatus::Open;
        self.quorum = quorum;
        self.votes = 0;
        self.bump = bump;
        self.expiry = Clock::get()?.slot.checked_add(expiry).ok_or(DaoError::Overflow)?;
        Ok(())
    }

    pub fn try_finalize(
        &mut self
    ) {
        if self.votes >= self.quorum && self.check_expiry().is_ok() {
            self.result = ProposalStatus::Succeeded
        } else if self.votes < self.quorum && self.check_expiry().is_err() {
            self.result = ProposalStatus::Failed
        }
    }

    pub fn check_expiry(
        &mut self
    ) -> Result<()> {
        require!(Clock::get()?.slot < self.expiry, DaoError::Expired);
        Ok(())
    }

    pub fn is_open(
        &mut self
    ) -> Result<()> {
        require!(self.result == ProposalStatus::Open, DaoError::InvalidProposalStatus);
        Ok(())
    }

    pub fn is_succeeded(
        &self
    ) -> Result<()> {
        require!(self.result == ProposalStatus::Succeeded, DaoError::InvalidProposalStatus);
        Ok(())
    }

    pub fn is_failed(
        &self
    ) -> Result<()> {
        require!(self.result == ProposalStatus::Failed, DaoError::InvalidProposalStatus);
        Ok(())
    }

    pub fn add_vote(
        &mut self,
        amount: u64
    ) -> Result<()> {
        self.votes = self.votes.checked_add(amount).ok_or(DaoError::Overflow)?;
        self.try_finalize();
        Ok(())
    }

    pub fn remove_vote(
        &mut self,
        amount: u64
    ) -> Result<()> {
        self.votes = self.votes.checked_sub(amount).ok_or(DaoError::Underflow)?;
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Copy, Clone, PartialEq, Eq)]
pub enum ProposalType {
    Bounty(Pubkey, u64), // Pay an address some amount of SOL
    Executable, // Sign some kind of instruction(s) with an accounts struct, etc
    Vote // We just want to know what people think. No money involved
}

#[derive(AnchorSerialize, AnchorDeserialize, Copy, Clone, Debug, PartialEq, Eq)]
pub enum ProposalStatus {
    Open,
    Succeeded,
    Failed
}


#[account]
pub struct VoteState {
    pub owner: Pubkey,
    pub amount: u64,
    pub bump: u8
}

impl VoteState {
    pub const LEN: usize = 8 + PUBKEY_L + U64_L + U8_L;

    pub fn init(
        &mut self,
        owner: Pubkey,
        amount: u64,
        bump: u8,
    ) -> Result<()> {
        self.owner = owner;
        self.amount = amount;
        self.bump = bump;
        Ok(())
    }
}


#[derive(Accounts)]
pub struct Unvote<'info> {
    #[account(mut)]
    owner: Signer<'info>,
    #[account(
        mut,
        seeds=[b"stake", config.key().as_ref(), owner.key().as_ref()],
        bump = stake_state.state_bump
    )]
    stake_state: Account<'info, StakeState>,
    #[account(
        mut,
        seeds=[b"proposal", config.key().as_ref(), proposal.id.to_le_bytes().as_ref()],
        bump = proposal.bump,
    )]
    proposal: Account<'info, Proposal>,
    #[account(
        mut,
        close = treasury,
        seeds=[b"vote", proposal.key().as_ref(), owner.key().as_ref()],
        bump = vote.bump
    )]
    vote: Account<'info, VoteState>,
    #[account(
        seeds=[b"treasury", config.key().as_ref()],
        bump = config.treasury_bump
    )]
    treasury: SystemAccount<'info>,
    #[account(
        seeds=[b"config", config.seed.to_le_bytes().as_ref()],
        bump = config.config_bump
    )]
    config: Account<'info, DaoConfig>,
    system_program: Program<'info, System>
}

#[account]
pub struct StakeState {
    pub owner: Pubkey,
    pub amount: u64,
    pub accounts: u64,
    pub updated: u64,
    pub vault_bump: u8,
    pub auth_bump: u8,
    pub state_bump: u8,
}

impl StakeState {
    pub const LEN: usize = 8 + PUBKEY_L + 3 * U64_L + 3 * U8_L;

    pub fn init(
        &mut self,  
        owner: Pubkey,
        state_bump: u8,
        vault_bump: u8,
        auth_bump: u8
    ) -> Result<()> {
        self.owner = owner;
        self.amount = 0;
        self.accounts = 0;
        self.state_bump = state_bump;
        self.vault_bump = vault_bump;
        self.auth_bump = auth_bump;
        self.update()
    }

    pub fn stake(
        &mut self,
        amount: u64
    ) -> Result<()> {
        self.amount.checked_add(amount).ok_or(DaoError::Overflow)?;
        self.update()
    }

    pub fn unstake(
        &mut self,
        amount: u64
    ) -> Result<()> {
        self.check_accounts()?;
        self.check_slot()?; // Don't allow staking and unstaking in the same slot
        self.amount = self.amount.checked_sub(amount).ok_or(DaoError::Underflow)?;
        self.update()
    }

    pub fn add_account(&mut self) -> Result<()> {
        self.accounts = self.accounts.checked_add(1).ok_or(DaoError::Overflow)?;
        Ok(())
    }

    pub fn remove_account(&mut self) -> Result<()> {
        self.accounts = self.accounts.checked_sub(1).ok_or(DaoError::Underflow)?;
        Ok(())
    }

    // This might be convenient later, but comment out for now
    // pub fn remove_accounts(&mut self, amount: u64) -> Result<()> {
    //     self.accounts.checked_sub(amount).ok_or(DaoError::Underflow)
    // }

    pub fn update(&mut self) -> Result<()> {
        self.updated = Clock::get()?.slot;
        Ok(())
    }

    // Make sure the user doesn't unstake in the same slot
    pub fn check_slot(&mut self) -> Result<()> {
        require!(self.updated < Clock::get()?.slot, DaoError::InvalidSlot);
        Ok(())
    }    

    // Make sure the user doesn't have any open accounts
    pub fn check_accounts(&mut self) -> Result<()> {
        require!(self.accounts == 0, DaoError::AccountsOpen);
        Ok(())
    }

    // Ensure staked amount > 0
    pub fn check_stake(&mut self) -> Result<()> {
        require!(self.amount > 0, DaoError::InsufficientStake);
        Ok(())
    }

    // Ensure staked amount > X
    pub fn check_stake_amount(&mut self, amount: u64) -> Result<()> {
        require!(self.amount >= amount, DaoError::InsufficientStake);
        Ok(())
    }
}


#[error_code]
pub enum DaoError {
    #[msg("Default Error")]
    DefaultError,
    #[msg("Bump Error")]
    BumpError,
    #[msg("Overflow")]
    Overflow,
    #[msg("Underflow")]
    Underflow,
    #[msg("You can't unstake with open accounts")]
    AccountsOpen,
    #[msg("Proposal expired")]
    Expired,
    #[msg("Invalid slot")]
    InvalidSlot,
    #[msg("Insufficient stake")]
    InsufficientStake,
    #[msg("Invalid name")]
    InvalidName,
    #[msg("Invalid gist")]
    InvalidGist,
    #[msg("Invalid proposal seed")]
    InvalidProposalSeed,
    #[msg("Invalid quorum")]
    InvalidQuorum,
    #[msg("Invalid expiry")]
    InvalidExpiry,
    #[msg("Proposal closed")]
    ProposalClosed,
    #[msg("You can't vote 0!")]
    InvalidVoteAmount,
    #[msg("Invalid proposal status")]
    InvalidProposalStatus,
    #[msg("Invalid stake amount")]
    InvalidStakeAmount
}