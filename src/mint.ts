import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  getMintLen,
  createInitializeMetadataPointerInstruction,
  getMint,
  getMetadataPointerState,
  getTokenMetadata,
  TYPE_SIZE,
  LENGTH_SIZE,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  transfer,
  createAccount,
} from "@solana/spl-token";
import {
  createInitializeInstruction,
  createUpdateFieldInstruction,
  createRemoveKeyInstruction,
  pack,
  TokenMetadata,
} from "@solana/spl-token-metadata";

import dotenv from "dotenv";
import bs58 from "bs58";
import path from "path";
import fs from "fs";

dotenv.config();

// Decode the Base58 private key
// const base58PrivateKey = process.env.SOLANA_PRIVATE_KEY;

// if (!base58PrivateKey) {
//   throw new Error("SOLANA_PRIVATE_KEY is not set");
// }

// const decodedPrivateKey = bs58.decode(base58PrivateKey);

// // Generate the Keypair from the decoded private key
// const payer = Keypair.fromSecretKey(decodedPrivateKey);

if (!process.env.HOME) {
  throw new Error("HOME environment variable is not defined.");
}

const keypairPath = path.resolve(process.env.HOME, ".config/solana/id.json");
const secretKeyString = fs.readFileSync(keypairPath, { encoding: "utf-8" });
const secretKeyUint8Array = new Uint8Array(JSON.parse(secretKeyString));

const payer = Keypair.fromSecretKey(secretKeyUint8Array);

// Connection to devnet cluster
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// Transaction to send
let transaction = new Transaction();

let transactionSignature: string;

(async () => {
  console.log("My address:", payer.publicKey.toString());
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`My balance: ${balance / LAMPORTS_PER_SOL} SOL`);
})().catch(console.error);

// Generate new keypair for Mint Account
const mintKeypair = Keypair.generate();
// Address for Mint Account
const mint = mintKeypair.publicKey;
// Decimals for Mint Account

const decimals = 2;
// Authority that can mint new tokens
const mintAuthority = payer.publicKey;
// Authority that can update the metadata pointer and token metadata
const updateAuthority = payer.publicKey;

// Metadata to store in Mint Account
const metaData: TokenMetadata = {
  updateAuthority: updateAuthority,
  mint: mint,
  name: "OPOS",
  symbol: "OPOS",
  uri: "https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/DeveloperPortal/metadata.json",
  additionalMetadata: [["description", "Only Possible On Solana"]],
};

// Size of MetadataExtension 2 bytes for type, 2 bytes for length
const metadataExtension = TYPE_SIZE + LENGTH_SIZE;
// Size of metadata
const metadataLen = pack(metaData).length;

// Size of Mint Account with extension
const mintLen = getMintLen([ExtensionType.MetadataPointer]);

// Minimum lamports required for Mint Account
const lamports = await connection.getMinimumBalanceForRentExemption(
  mintLen + metadataExtension + metadataLen
);

// Instruction to invoke System Program to create new account
const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: payer.publicKey, // Account that will transfer lamports to created account
  newAccountPubkey: mint, // Address of the account to create
  space: mintLen, // Amount of bytes to allocate to the created account
  lamports, // Amount of lamports transferred to created account
  programId: TOKEN_2022_PROGRAM_ID, // Program assigned as owner of created account
});

// Instruction to initialize the MetadataPointer Extension
const initializeMetadataPointerInstruction =
  createInitializeMetadataPointerInstruction(
    mint, // Mint Account address
    updateAuthority, // Authority that can set the metadata address
    mint, // Account address that holds the metadata
    TOKEN_2022_PROGRAM_ID
  );

// Instruction to initialize Mint Account data
const initializeMintInstruction = createInitializeMintInstruction(
  mint, // Mint Account Address
  decimals, // Decimals of Mint
  mintAuthority, // Designated Mint Authority
  null, // Optional Freeze Authority
  TOKEN_2022_PROGRAM_ID // Token Extension Program ID
);

// Instruction to initialize Metadata Account data
const initializeMetadataInstruction = createInitializeInstruction({
  programId: TOKEN_2022_PROGRAM_ID, // Token Extension Program as Metadata Program
  metadata: mint, // Account address that holds the metadata
  updateAuthority: updateAuthority, // Authority that can update the metadata
  mint: mint, // Mint Account address
  mintAuthority: mintAuthority, // Designated Mint Authority
  name: metaData.name,
  symbol: metaData.symbol,
  uri: metaData.uri,
});

// Instruction to update metadata, adding custom field
const updateFieldInstruction = createUpdateFieldInstruction({
  programId: TOKEN_2022_PROGRAM_ID, // Token Extension Program as Metadata Program
  metadata: mint, // Account address that holds the metadata
  updateAuthority: updateAuthority, // Authority that can update the metadata
  field: metaData.additionalMetadata[0][0], // key
  value: metaData.additionalMetadata[0][1], // value
});

// Add instructions to new transaction
transaction = new Transaction().add(
  createAccountInstruction,
  initializeMetadataPointerInstruction,
  // note: the above instructions are required before initializing the mint
  initializeMintInstruction,
  initializeMetadataInstruction,
  updateFieldInstruction
);

// Send transaction
transactionSignature = await sendAndConfirmTransaction(
  connection,
  transaction,
  [payer, mintKeypair] // Signers
);

console.log(
  "\nCreate Mint Account:",
  `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`
);

// Retrieve mint information
const mintInfo = await getMint(
  connection,
  mint,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);

// Retrieve and log the metadata pointer state
const metadataPointer = getMetadataPointerState(mintInfo);
console.log("\nMetadata Pointer:", JSON.stringify(metadataPointer, null, 2));

// Retrieve and log the metadata state

console.log("mint = ", mint);
const metadata = await getTokenMetadata(
  connection,
  mint // Mint Account address
);
console.log("\nMetadata:", JSON.stringify(metadata, null, 2));

///////////

(async () => {
  try {
    const sourceTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer, // Payer to create Token Account
      mint, // Mint Account address
      payer.publicKey, // Token Account owner
      false, // Skip owner check
      undefined, // Optional keypair, default to Associated Token Account
      undefined, // Confirmation options
      TOKEN_2022_PROGRAM_ID // Token Extension Program ID
    ).then((ata) => ata.address);

    console.log("Token Account:", sourceTokenAccount);

    transactionSignature = await mintTo(
      connection,
      payer, // Transaction fee payer
      mint, // Mint Account address
      sourceTokenAccount, // Mint to
      mintAuthority, // Mint Authority address
      2001_00, // Amount
      undefined, // Additional signers
      undefined, // Confirmation options
      TOKEN_2022_PROGRAM_ID // Token Extension Program ID
    );

    console.log(
      "\nMint Tokens:",
      `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`
    );

    const transferAmount = BigInt(1000_00);

    // Random keypair to use as owner of Token Account
    // const randomKeypair = new Keypair();
    // Create Token Account for random keypair

    // console.log("Random Keypair:", randomKeypair.publicKey.toString());
    // const destinationTokenAccount = await createAccount(
    //   connection,
    //   payer, // Payer to create Token Account
    //   mint, // Mint Account address
    //   randomKeypair.publicKey, // Token Account owner
    //   undefined, // Optional keypair, default to Associated Token Account
    //   undefined, // Confirmation options
    //   TOKEN_2022_PROGRAM_ID // Token Extension Program ID
    // );

    // const transferred = await transfer(
    //   connection,
    //   payer,
    //   sourceTokenAccount,
    //   payer.publicKey,
    //   payer.publicKey,
    //   transferAmount,
    //   [],
    //   undefined,
    //   TOKEN_2022_PROGRAM_ID
    // );

    // console.log("Transferred", transferred);



  } catch (error) {
    console.error("Error minting tokens:", error);
  }
})();
