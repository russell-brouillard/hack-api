import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import { TokenMetadata } from "@solana/spl-token-metadata";
import { encode } from "bs58";
import {
  createMetadataMint,
  getTokensByOwner,
  mintToAccount,
} from "./solanaService";
import { TokenObject } from "userTypes";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createEnableRequiredMemoTransfersInstruction,
  createInitializeAccountInstruction,
  getAccountLen,
} from "@solana/spl-token";

export async function createItem(
  payer: Keypair,
  description: string
): Promise<{
  owner: PublicKey;
  mint: PublicKey;
  tokenAccount: string;
  itemSecret: string;
  description: string;
  itemPublic: string;
}> {
  // Initialize connection to Solana cluster

  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  const itemKeyPair = Keypair.generate();
  const itemPublic = itemKeyPair.publicKey.toString();
  const mintKeypair = Keypair.generate();

  // Define authorities
  const updateAuthority = payer.publicKey;
  const mintAuthority = payer.publicKey;
  const decimals = 0;
  const mint = mintKeypair.publicKey;
  const secrect = encode(itemKeyPair.secretKey);

  // Define metadata for the mint
  const metaData: TokenMetadata = {
    updateAuthority,
    mint: mintKeypair.publicKey,
    name: "ITEM",
    symbol: "POME",
    uri: "https://www.pomerene.net/api/v1/json/metadata.json",
    additionalMetadata: [
      ["secret", secrect],
      ["description", description],
      ["public", itemPublic],
    ],
  };

  // CREATE MINTMETADATA

  await createMetadataMint(
    metaData,
    payer,
    mint,
    mintAuthority,
    decimals,
    connection,
    mintKeypair,
    updateAuthority
  );

  // Size of Token Account with extension
  const accountLen = getAccountLen([ExtensionType.MemoTransfer]);
  // Minimum lamports required for Token Account
  const lamports = await connection.getMinimumBalanceForRentExemption(
    accountLen
  );

  


  const memoAccountKeyPair = Keypair.generate();

  // Instruction to invoke System Program to create new account
  const createAccountInstructionMemo = SystemProgram.createAccount({
    fromPubkey: payer.publicKey, // Account that will transfer lamports to created account
    newAccountPubkey: memoAccountKeyPair.publicKey, // Address of the account to create
    space: accountLen, // Amount of bytes to allocate to the created account
    lamports, // Amount of lamports transferred to created account
    programId: TOKEN_2022_PROGRAM_ID, // Program assigned as owner of created account
  });

  // Instruction to initialize Token Account data
  const initializeAccountInstructionMemo = createInitializeAccountInstruction(
    memoAccountKeyPair.publicKey, // Token Account Address
    mint, // Mint Account
    payer.publicKey, // Token Account Owner
    TOKEN_2022_PROGRAM_ID // Token Extension Program ID
  );

  // Instruction to initialize the MemoTransfer Extension
  const enableRequiredMemoTransfersInstruction =
    createEnableRequiredMemoTransfersInstruction(
      memoAccountKeyPair.publicKey, // Token Account address
      payer.publicKey, // Token Account Owner
      undefined, // Additional signers
      TOKEN_2022_PROGRAM_ID // Token Program ID
    );

  // Add instructions to new transaction
  const transactionMemo = new Transaction().add(
    createAccountInstructionMemo,
    initializeAccountInstructionMemo,
    enableRequiredMemoTransfersInstruction
  );

  // Send transaction
  await sendAndConfirmTransaction(
    connection,
    transactionMemo,
    [payer, memoAccountKeyPair] // Signers
  );

  // SEND NEW TOKENS

  const tokenAccount = await mintToAccount(
    payer,
    mint,
    mintAuthority,
    connection,
    itemKeyPair,
    payer.publicKey,
    1
  );

  const tokenAccountMint = await mintToAccount(
    payer,
    mint,
    mintAuthority,
    connection,
    itemKeyPair,
    itemKeyPair.publicKey,
    0
  );

  return {
    owner: payer.publicKey,
    mint: mint,
    tokenAccount: tokenAccount.toString(),
    itemSecret: encode(itemKeyPair.secretKey),
    itemPublic: itemPublic,
    description,
  };
}

export async function fetchItems(owner: Keypair): Promise<any> {
  const tokens = await getTokensByOwner(owner.publicKey);

  return tokens.filter(
    (token: TokenObject) =>
      token.metadata.name.toLowerCase() === "item" && token.tokenAmount > 0
  );
}
