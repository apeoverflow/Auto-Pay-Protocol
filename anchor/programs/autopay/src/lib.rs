use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("AUToPay1111111111111111111111111111111111111");

// ──────────────────────────────────────────────
//  Constants (mirrors Solidity PolicyManager)
// ──────────────────────────────────────────────

pub const MIN_INTERVAL: u32 = 60; // 1 minute
pub const MAX_INTERVAL: u32 = 365 * 24 * 60 * 60; // 365 days
pub const PROTOCOL_FEE_BPS: u64 = 250; // 2.5%
pub const BPS_DENOMINATOR: u64 = 10_000;
pub const MAX_RETRIES: u8 = 3;
pub const POLICY_SEED: &[u8] = b"policy";
pub const PROTOCOL_STATE_SEED: &[u8] = b"protocol_state";
pub const FEE_VAULT_SEED: &[u8] = b"fee_vault";
pub const MAX_METADATA_LEN: usize = 256;

#[program]
pub mod autopay {
    use super::*;

    /// One-time setup: initializes the global protocol state and fee vault.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.protocol_state;
        state.authority = ctx.accounts.authority.key();
        state.fee_recipient = ctx.accounts.authority.key();
        state.usdc_mint = ctx.accounts.usdc_mint.key();
        state.policy_count = 0;
        state.total_policies_created = 0;
        state.total_charges_processed = 0;
        state.total_volume_processed = 0;
        state.bump = ctx.bumps.protocol_state;
        state.fee_vault_bump = ctx.bumps.fee_vault;
        Ok(())
    }

    /// Create a subscription policy with an immediate first charge.
    /// The payer must have already delegated (approved) enough USDC to their
    /// token account's delegate for the charge amount.
    pub fn create_policy(
        ctx: Context<CreatePolicy>,
        charge_amount: u64,
        interval: u32,
        spending_cap: u64,
        metadata_url: String,
    ) -> Result<()> {
        require!(charge_amount > 0, AutoPayError::InvalidAmount);
        require!(
            interval >= MIN_INTERVAL && interval <= MAX_INTERVAL,
            AutoPayError::InvalidInterval
        );
        require!(
            metadata_url.len() <= MAX_METADATA_LEN,
            AutoPayError::MetadataTooLong
        );

        let clock = Clock::get()?;
        let now = clock.unix_timestamp as u32;

        // Capture keys before mutable borrows
        let policy_key = ctx.accounts.policy.key();
        let payer_key = ctx.accounts.payer.key();
        let merchant_key = ctx.accounts.merchant.key();

        let state = &mut ctx.accounts.protocol_state;
        let policy_index = state.policy_count;
        state.policy_count += 1;
        state.total_policies_created += 1;
        state.total_charges_processed += 1;
        state.total_volume_processed += charge_amount as u128;

        // Initialize policy account
        let policy = &mut ctx.accounts.policy;
        policy.payer = payer_key;
        policy.merchant = merchant_key;
        policy.charge_amount = charge_amount;
        policy.spending_cap = spending_cap;
        policy.total_spent = charge_amount; // includes first charge
        policy.interval = interval;
        policy.last_charged = now;
        policy.charge_count = 1;
        policy.consecutive_failures = 0;
        policy.end_time = 0;
        policy.active = true;
        policy.metadata_url = metadata_url.clone();
        policy.policy_index = policy_index;
        policy.bump = ctx.bumps.policy;

        // Execute first charge
        let protocol_fee = calculate_protocol_fee(charge_amount);
        let merchant_amount = charge_amount
            .checked_sub(protocol_fee)
            .ok_or(AutoPayError::Overflow)?;

        // Transfer merchant amount from payer's token account to merchant
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.payer_token_account.to_account_info(),
                    to: ctx.accounts.merchant_token_account.to_account_info(),
                    authority: ctx.accounts.payer.to_account_info(),
                },
            ),
            merchant_amount,
        )?;

        // Transfer protocol fee from payer to fee vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.payer_token_account.to_account_info(),
                    to: ctx.accounts.fee_vault.to_account_info(),
                    authority: ctx.accounts.payer.to_account_info(),
                },
            ),
            protocol_fee,
        )?;

        emit!(PolicyCreated {
            policy: policy_key,
            payer: payer_key,
            merchant: merchant_key,
            charge_amount,
            interval,
            spending_cap,
            metadata_url,
        });

        emit!(ChargeSucceeded {
            policy: policy_key,
            payer: payer_key,
            merchant: merchant_key,
            merchant_amount,
            protocol_fee,
        });

        Ok(())
    }

    /// Payer revokes their own policy.
    pub fn revoke_policy(ctx: Context<RevokePolicy>) -> Result<()> {
        let policy_key = ctx.accounts.policy.key();
        let policy = &mut ctx.accounts.policy;
        require!(policy.active, AutoPayError::PolicyNotActive);

        let clock = Clock::get()?;
        policy.active = false;
        policy.end_time = clock.unix_timestamp as u32;

        emit!(PolicyRevoked {
            policy: policy_key,
            payer: policy.payer,
            merchant: policy.merchant,
            end_time: policy.end_time,
        });

        Ok(())
    }

    /// Relayer executes a recurring charge on a due policy.
    /// The payer must have set a delegate on their token account with enough
    /// delegated amount for the charge. The relayer calls this instruction
    /// and the transfer uses the payer's delegate authority.
    pub fn charge(ctx: Context<Charge>) -> Result<bool> {
        let policy_key = ctx.accounts.policy.key();
        let policy = &mut ctx.accounts.policy;
        let state = &mut ctx.accounts.protocol_state;

        require!(policy.active, AutoPayError::PolicyNotActive);
        require!(
            policy.consecutive_failures < MAX_RETRIES,
            AutoPayError::MaxRetriesReached
        );

        let clock = Clock::get()?;
        let now = clock.unix_timestamp as u32;
        require!(
            now >= policy.last_charged.saturating_add(policy.interval),
            AutoPayError::TooSoonToCharge
        );

        if policy.spending_cap > 0 {
            require!(
                policy
                    .total_spent
                    .checked_add(policy.charge_amount)
                    .ok_or(AutoPayError::Overflow)?
                    <= policy.spending_cap,
                AutoPayError::SpendingCapExceeded
            );
        }

        let charge_amount = policy.charge_amount;
        let payer_pubkey = policy.payer;
        let merchant_pubkey = policy.merchant;

        // Check payer token account balance (soft-fail)
        let payer_balance = ctx.accounts.payer_token_account.amount;
        if payer_balance < charge_amount {
            policy.consecutive_failures += 1;
            policy.last_charged = now;
            emit!(ChargeFailed {
                policy: policy_key,
                reason: "Insufficient balance".to_string(),
            });
            return Ok(false);
        }

        // Check delegated amount (soft-fail)
        let delegated = ctx.accounts.payer_token_account.delegated_amount;
        if delegated < charge_amount {
            policy.consecutive_failures += 1;
            policy.last_charged = now;
            emit!(ChargeFailed {
                policy: policy_key,
                reason: "Insufficient delegated amount".to_string(),
            });
            return Ok(false);
        }

        // Update policy state before transfers
        policy.last_charged = now;
        policy.total_spent = policy
            .total_spent
            .checked_add(charge_amount)
            .ok_or(AutoPayError::Overflow)?;
        policy.charge_count += 1;
        policy.consecutive_failures = 0;

        state.total_charges_processed += 1;
        state.total_volume_processed += charge_amount as u128;

        let protocol_fee = calculate_protocol_fee(charge_amount);
        let merchant_amount = charge_amount
            .checked_sub(protocol_fee)
            .ok_or(AutoPayError::Overflow)?;

        // Transfer merchant amount: payer → merchant (via delegate)
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.payer_token_account.to_account_info(),
                    to: ctx.accounts.merchant_token_account.to_account_info(),
                    authority: ctx.accounts.delegate.to_account_info(),
                },
            ),
            merchant_amount,
        )?;

        // Transfer protocol fee: payer → fee vault (via delegate)
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.payer_token_account.to_account_info(),
                    to: ctx.accounts.fee_vault.to_account_info(),
                    authority: ctx.accounts.delegate.to_account_info(),
                },
            ),
            protocol_fee,
        )?;

        emit!(ChargeSucceeded {
            policy: policy_key,
            payer: payer_pubkey,
            merchant: merchant_pubkey,
            merchant_amount,
            protocol_fee,
        });

        Ok(true)
    }

    /// Cancel a policy that has reached MAX_RETRIES consecutive failures.
    pub fn cancel_failed_policy(ctx: Context<CancelFailedPolicy>) -> Result<()> {
        let policy_key = ctx.accounts.policy.key();
        let policy = &mut ctx.accounts.policy;
        require!(policy.active, AutoPayError::PolicyNotActive);
        require!(
            policy.consecutive_failures >= MAX_RETRIES,
            AutoPayError::PolicyNotFailedEnough
        );

        let clock = Clock::get()?;
        policy.active = false;
        policy.end_time = clock.unix_timestamp as u32;

        emit!(PolicyCancelledByFailure {
            policy: policy_key,
            payer: policy.payer,
            merchant: policy.merchant,
            consecutive_failures: policy.consecutive_failures,
            end_time: policy.end_time,
        });

        Ok(())
    }

    /// Withdraw accumulated fees to the fee recipient.
    pub fn withdraw_fees(ctx: Context<WithdrawFees>) -> Result<()> {
        let fee_vault = &ctx.accounts.fee_vault;
        let amount = fee_vault.amount;
        require!(amount > 0, AutoPayError::NothingToWithdraw);

        let state = &ctx.accounts.protocol_state;
        let seeds = &[
            FEE_VAULT_SEED,
            state.usdc_mint.as_ref(),
            &[state.fee_vault_bump],
        ];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.fee_vault.to_account_info(),
                    to: ctx.accounts.recipient_token_account.to_account_info(),
                    authority: ctx.accounts.fee_vault.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        emit!(FeesWithdrawn {
            recipient: ctx.accounts.protocol_state.fee_recipient,
            amount,
        });

        Ok(())
    }

    /// Update fee recipient (admin only).
    pub fn set_fee_recipient(ctx: Context<SetFeeRecipient>, new_recipient: Pubkey) -> Result<()> {
        ctx.accounts.protocol_state.fee_recipient = new_recipient;
        Ok(())
    }
}

// ──────────────────────────────────────────────
//  Account Structs (contexts)
// ──────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + ProtocolState::INIT_SPACE,
        seeds = [PROTOCOL_STATE_SEED],
        bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        token::mint = usdc_mint,
        token::authority = fee_vault,
        seeds = [FEE_VAULT_SEED, usdc_mint.key().as_ref()],
        bump
    )]
    pub fee_vault: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CreatePolicy<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Merchant wallet address, validated as non-zero by instruction logic.
    pub merchant: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [PROTOCOL_STATE_SEED],
        bump = protocol_state.bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(
        init,
        payer = payer,
        space = 8 + Policy::INIT_SPACE,
        seeds = [POLICY_SEED, payer.key().as_ref(), &protocol_state.policy_count.to_le_bytes()],
        bump
    )]
    pub policy: Account<'info, Policy>,

    #[account(
        mut,
        constraint = payer_token_account.owner == payer.key() @ AutoPayError::TokenAccountMismatch,
        constraint = payer_token_account.mint == protocol_state.usdc_mint @ AutoPayError::WrongMint,
    )]
    pub payer_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = merchant_token_account.owner == merchant.key() @ AutoPayError::TokenAccountMismatch,
        constraint = merchant_token_account.mint == protocol_state.usdc_mint @ AutoPayError::WrongMint,
    )]
    pub merchant_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [FEE_VAULT_SEED, protocol_state.usdc_mint.as_ref()],
        bump = protocol_state.fee_vault_bump
    )]
    pub fee_vault: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RevokePolicy<'info> {
    pub payer: Signer<'info>,

    #[account(
        mut,
        constraint = policy.payer == payer.key() @ AutoPayError::NotPolicyOwner,
    )]
    pub policy: Account<'info, Policy>,
}

#[derive(Accounts)]
pub struct Charge<'info> {
    /// The relayer/crank that submits the charge transaction.
    pub relayer: Signer<'info>,

    /// The delegate authority set on the payer's token account.
    /// CHECK: Validated by the SPL token transfer CPI — if this isn't the
    /// actual delegate, the transfer will fail.
    pub delegate: UncheckedAccount<'info>,

    #[account(mut)]
    pub policy: Account<'info, Policy>,

    #[account(
        mut,
        seeds = [PROTOCOL_STATE_SEED],
        bump = protocol_state.bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(
        mut,
        constraint = payer_token_account.owner == policy.payer @ AutoPayError::TokenAccountMismatch,
        constraint = payer_token_account.mint == protocol_state.usdc_mint @ AutoPayError::WrongMint,
    )]
    pub payer_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = merchant_token_account.owner == policy.merchant @ AutoPayError::TokenAccountMismatch,
        constraint = merchant_token_account.mint == protocol_state.usdc_mint @ AutoPayError::WrongMint,
    )]
    pub merchant_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [FEE_VAULT_SEED, protocol_state.usdc_mint.as_ref()],
        bump = protocol_state.fee_vault_bump
    )]
    pub fee_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelFailedPolicy<'info> {
    pub caller: Signer<'info>,

    #[account(mut)]
    pub policy: Account<'info, Policy>,
}

#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    #[account(
        constraint = authority.key() == protocol_state.authority @ AutoPayError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(
        seeds = [PROTOCOL_STATE_SEED],
        bump = protocol_state.bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(
        mut,
        seeds = [FEE_VAULT_SEED, protocol_state.usdc_mint.as_ref()],
        bump = protocol_state.fee_vault_bump
    )]
    pub fee_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = recipient_token_account.mint == protocol_state.usdc_mint @ AutoPayError::WrongMint,
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SetFeeRecipient<'info> {
    #[account(
        constraint = authority.key() == protocol_state.authority @ AutoPayError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [PROTOCOL_STATE_SEED],
        bump = protocol_state.bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,
}

// ──────────────────────────────────────────────
//  State Accounts
// ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct ProtocolState {
    pub authority: Pubkey,
    pub fee_recipient: Pubkey,
    pub usdc_mint: Pubkey,
    pub policy_count: u64,
    pub total_policies_created: u64,
    pub total_charges_processed: u64,
    pub total_volume_processed: u128,
    pub bump: u8,
    pub fee_vault_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Policy {
    pub payer: Pubkey,
    pub merchant: Pubkey,
    pub charge_amount: u64,
    pub spending_cap: u64,
    pub total_spent: u64,
    pub interval: u32,
    pub last_charged: u32,
    pub charge_count: u32,
    pub consecutive_failures: u8,
    pub end_time: u32,
    pub active: bool,
    pub policy_index: u64,
    pub bump: u8,
    #[max_len(256)]
    pub metadata_url: String,
}

// ──────────────────────────────────────────────
//  Events (match Solidity events)
// ──────────────────────────────────────────────

#[event]
pub struct PolicyCreated {
    pub policy: Pubkey,
    pub payer: Pubkey,
    pub merchant: Pubkey,
    pub charge_amount: u64,
    pub interval: u32,
    pub spending_cap: u64,
    pub metadata_url: String,
}

#[event]
pub struct PolicyRevoked {
    pub policy: Pubkey,
    pub payer: Pubkey,
    pub merchant: Pubkey,
    pub end_time: u32,
}

#[event]
pub struct ChargeSucceeded {
    pub policy: Pubkey,
    pub payer: Pubkey,
    pub merchant: Pubkey,
    pub merchant_amount: u64,
    pub protocol_fee: u64,
}

#[event]
pub struct ChargeFailed {
    pub policy: Pubkey,
    pub reason: String,
}

#[event]
pub struct PolicyCancelledByFailure {
    pub policy: Pubkey,
    pub payer: Pubkey,
    pub merchant: Pubkey,
    pub consecutive_failures: u8,
    pub end_time: u32,
}

#[event]
pub struct FeesWithdrawn {
    pub recipient: Pubkey,
    pub amount: u64,
}

// ──────────────────────────────────────────────
//  Errors
// ──────────────────────────────────────────────

#[error_code]
pub enum AutoPayError {
    #[msg("Merchant address cannot be default")]
    InvalidMerchant,
    #[msg("Charge amount must be greater than zero")]
    InvalidAmount,
    #[msg("Interval must be between 1 minute and 365 days")]
    InvalidInterval,
    #[msg("Policy is not active")]
    PolicyNotActive,
    #[msg("Too soon to charge this policy")]
    TooSoonToCharge,
    #[msg("Spending cap would be exceeded")]
    SpendingCapExceeded,
    #[msg("Only the policy payer can do this")]
    NotPolicyOwner,
    #[msg("No fees to withdraw")]
    NothingToWithdraw,
    #[msg("Policy has not failed enough times to cancel")]
    PolicyNotFailedEnough,
    #[msg("Max consecutive retries reached")]
    MaxRetriesReached,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Token account does not match expected owner")]
    TokenAccountMismatch,
    #[msg("Token mint does not match USDC")]
    WrongMint,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Metadata URL too long")]
    MetadataTooLong,
}

// ──────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────

pub fn calculate_protocol_fee(amount: u64) -> u64 {
    (amount as u128 * PROTOCOL_FEE_BPS as u128 / BPS_DENOMINATOR as u128) as u64
}
