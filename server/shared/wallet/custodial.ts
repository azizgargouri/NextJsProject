import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Wallet, type TypedDataDomain, type TypedDataField } from 'ethers';
import { env } from '../../config/env';

/**
 * Custodial app wallets.
 *
 * Every HR/employee account gets an app-managed Ethereum wallet. The private
 * key is encrypted at rest with AES-256-GCM and never leaves the server; the
 * API only exposes the public address. The server signs contract intents on
 * behalf of the account owner.
 *
 * This is a deliberate demo/self-contained design. For production, prefer a
 * dedicated wallet-as-a-service or a non-custodial embedded wallet.
 */

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface CustodialWallet {
  /** Lower-case public address. */
  address: string;
  /** Plain private key — only returned at generation time, never persisted. */
  privateKey: string;
  /** AES-256-GCM payload stored in MongoDB. */
  encryptedPrivateKey: string;
}

export interface StoredWallet {
  address: string;
  encryptedPrivateKey: string;
}

function encryptionKey(): Buffer {
  const raw = env().WALLET_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      'WALLET_ENCRYPTION_KEY is not configured. Generate a 32-byte hex key and add it to the app .env before creating or signing with app wallets.',
    );
  }

  const hex = raw.startsWith('0x') ? raw.slice(2) : raw;
  if (!/^[a-fA-F0-9]{64}$/.test(hex)) {
    throw new Error('WALLET_ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars).');
  }

  return Buffer.from(hex, 'hex');
}

/** Generates a fresh wallet and its encrypted private-key payload. */
export function generateCustodialWallet(): CustodialWallet {
  const wallet = Wallet.createRandom();
  return {
    address: wallet.address.toLowerCase(),
    privateKey: wallet.privateKey,
    encryptedPrivateKey: encryptPrivateKey(wallet.privateKey),
  };
}

/** Encrypts a private key as `v1:<iv>:<authTag>:<ciphertext>` (base64 parts). */
export function encryptPrivateKey(privateKey: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

/** Decrypts a stored wallet payload. Throws if the key changed or data was tampered with. */
export function decryptPrivateKey(encryptedPrivateKey: string): string {
  const [version, ivPart, tagPart, ciphertextPart] = encryptedPrivateKey.split(':');
  if (version !== VERSION || !ivPart || !tagPart || !ciphertextPart) {
    throw new Error('Stored wallet key has an unsupported format.');
  }

  const iv = Buffer.from(ivPart, 'base64');
  const tag = Buffer.from(tagPart, 'base64');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('Stored wallet key is corrupted.');
  }

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** Rebuilds the ethers wallet from its encrypted payload. */
export function walletFromEncryptedKey(encryptedPrivateKey: string): Wallet {
  return new Wallet(decryptPrivateKey(encryptedPrivateKey));
}

/** Signs EIP-712 typed data with a stored wallet key. */
export function signTypedDataWithEncryptedKey(
  encryptedPrivateKey: string,
  domain: TypedDataDomain,
  types: Record<string, TypedDataField[]>,
  message: object,
): Promise<string> {
  return walletFromEncryptedKey(encryptedPrivateKey).signTypedData(
    domain,
    types,
    message as Record<string, unknown>,
  );
}
