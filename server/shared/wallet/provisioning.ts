import { connectMongo } from '../database/mongoose';
import { EmployeeModel } from '../database/models/employee.model';
import { UserModel } from '../database/models/user.model';
import { generateCustodialWallet, walletsConfigured, type StoredWallet } from './custodial';

/**
 * Wallet provisioning + email-based synchronisation.
 *
 * A person can exist twice: once as an auth `User` (sign-in) and once as an
 * `Employee` (HR directory). Both records must point at the same app wallet,
 * so every mutation here writes the address and encrypted key to both
 * collections when the email matches.
 */

interface WalletFields {
  walletAddress?: string | null;
  walletPrivateKeyEncrypted?: string | null;
}

function fromDoc(doc: WalletFields | null): StoredWallet | null {
  if (!doc?.walletAddress || !doc.walletPrivateKeyEncrypted) return null;
  return {
    address: doc.walletAddress.toLowerCase(),
    encryptedPrivateKey: doc.walletPrivateKeyEncrypted,
  };
}

function generatedWallet(): StoredWallet {
  const wallet = generateCustodialWallet();
  return {
    address: wallet.address,
    encryptedPrivateKey: wallet.encryptedPrivateKey,
  };
}

/** Writes the same wallet to the user and employee rows matching this email. */
export async function syncWalletForEmail(email: string, wallet: StoredWallet): Promise<void> {
  await connectMongo();
  const normalized = email.trim().toLowerCase();
  const fields = {
    walletAddress: wallet.address,
    walletPrivateKeyEncrypted: wallet.encryptedPrivateKey,
  };

  await Promise.all([
    UserModel.updateOne({ email: normalized, deletedAt: null }, { $set: fields }),
    EmployeeModel.updateOne({ email: normalized }, { $set: fields }),
  ]);
}

/**
 * Returns the wallet already attached to this email (user first, then
 * employee), or creates one and attaches it to both records.
 */
export async function ensureWalletForEmail(email: string): Promise<StoredWallet> {
  await connectMongo();
  const normalized = email.trim().toLowerCase();

  const [user, employee] = await Promise.all([
    UserModel.findOne({ email: normalized, deletedAt: null }).lean(),
    EmployeeModel.findOne({ email: normalized }).lean(),
  ]);

  const existing = fromDoc(user) ?? fromDoc(employee);
  if (existing) {
    await syncWalletForEmail(normalized, existing);
    return existing;
  }

  const wallet = generatedWallet();
  await syncWalletForEmail(normalized, wallet);
  return wallet;
}

/**
 * Wallet for a new account, when wallets are configured. Sign-up must never
 * depend on the HR contract module: without WALLET_ENCRYPTION_KEY the account
 * is created without one, and the contract flow provisions it on first use.
 */
export async function walletForNewAccount(email: string): Promise<StoredWallet | null> {
  if (!walletsConfigured()) return null;
  return ensureWalletForEmail(email);
}

/** Ensures the authenticated user has a wallet (used by the contract flow). */
export async function ensureUserWalletById(userId: string): Promise<StoredWallet> {
  await connectMongo();
  const user = await UserModel.findById(userId).lean();
  if (!user) throw new Error('User not found while provisioning a wallet.');

  const existing = fromDoc(user);
  if (existing) {
    await syncWalletForEmail(user.email, existing);
    return existing;
  }

  const wallet = generatedWallet();
  await syncWalletForEmail(user.email, wallet);
  return wallet;
}

/** Ensures an HR directory employee has a wallet (used by the contract flow). */
export async function ensureEmployeeWalletById(employeeId: string): Promise<StoredWallet> {
  await connectMongo();
  const employee = await EmployeeModel.findById(employeeId).lean();
  if (!employee) throw new Error('Employee not found while provisioning a wallet.');

  const existing = fromDoc(employee);
  if (existing) {
    await syncWalletForEmail(employee.email, existing);
    return existing;
  }

  const wallet = generatedWallet();
  await syncWalletForEmail(employee.email, wallet);
  return wallet;
}
