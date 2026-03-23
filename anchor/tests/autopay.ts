import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  approve,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";
import { Autopay } from "../target/types/autopay";

describe("autopay", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Autopay as Program<Autopay>;

  let usdcMint: anchor.web3.PublicKey;
  let payerTokenAccount: anchor.web3.PublicKey;
  let merchantTokenAccount: anchor.web3.PublicKey;
  let recipientTokenAccount: anchor.web3.PublicKey;
  let protocolStatePda: anchor.web3.PublicKey;
  let feeVaultPda: anchor.web3.PublicKey;

  const merchant = anchor.web3.Keypair.generate();
  const payer = provider.wallet;

  before(async () => {
    // Create mock USDC mint
    usdcMint = await createMint(
      provider.connection,
      (payer as any).payer,
      payer.publicKey,
      null,
      6 // USDC has 6 decimals
    );

    // Create token accounts
    payerTokenAccount = await createAccount(
      provider.connection,
      (payer as any).payer,
      usdcMint,
      payer.publicKey
    );

    merchantTokenAccount = await createAccount(
      provider.connection,
      (payer as any).payer,
      usdcMint,
      merchant.publicKey
    );

    recipientTokenAccount = await createAccount(
      provider.connection,
      (payer as any).payer,
      usdcMint,
      payer.publicKey
    );

    // Mint 1000 USDC to payer
    await mintTo(
      provider.connection,
      (payer as any).payer,
      usdcMint,
      payerTokenAccount,
      payer.publicKey,
      1_000_000_000 // 1000 USDC
    );

    // Derive PDAs
    [protocolStatePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_state")],
      program.programId
    );

    [feeVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("fee_vault"), usdcMint.toBuffer()],
      program.programId
    );
  });

  it("initializes the protocol", async () => {
    await program.methods
      .initialize()
      .accounts({
        authority: payer.publicKey,
        protocolState: protocolStatePda,
        usdcMint,
        feeVault: feeVaultPda,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const state = await program.account.protocolState.fetch(protocolStatePda);
    assert.ok(state.authority.equals(payer.publicKey));
    assert.equal(state.policyCount.toNumber(), 0);
  });

  it("creates a policy with first charge", async () => {
    const chargeAmount = 10_000_000; // 10 USDC
    const interval = 86400; // 1 day
    const spendingCap = 100_000_000; // 100 USDC

    const [policyPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("policy"),
        payer.publicKey.toBuffer(),
        new anchor.BN(0).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .createPolicy(
        new anchor.BN(chargeAmount),
        interval,
        new anchor.BN(spendingCap),
        "https://example.com/plan.json"
      )
      .accounts({
        payer: payer.publicKey,
        merchant: merchant.publicKey,
        protocolState: protocolStatePda,
        policy: policyPda,
        payerTokenAccount,
        merchantTokenAccount,
        feeVault: feeVaultPda,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const policy = await program.account.policy.fetch(policyPda);
    assert.ok(policy.active);
    assert.equal(policy.chargeAmount.toNumber(), chargeAmount);
    assert.equal(policy.chargeCount, 1);
    assert.equal(policy.interval, interval);

    // Verify merchant received payment minus fee
    const merchantAcc = await getAccount(
      provider.connection,
      merchantTokenAccount
    );
    const expectedFee = Math.floor((chargeAmount * 250) / 10000);
    assert.equal(
      Number(merchantAcc.amount),
      chargeAmount - expectedFee
    );
  });

  it("revokes a policy", async () => {
    const [policyPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("policy"),
        payer.publicKey.toBuffer(),
        new anchor.BN(0).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .revokePolicy()
      .accounts({
        payer: payer.publicKey,
        policy: policyPda,
      })
      .rpc();

    const policy = await program.account.policy.fetch(policyPda);
    assert.isFalse(policy.active);
    assert.isAbove(policy.endTime, 0);
  });
});
