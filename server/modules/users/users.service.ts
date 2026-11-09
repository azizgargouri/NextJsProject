import { AbstractCrudService } from '../../shared/database/crud-service';
import { hashPassword } from '../../shared/auth/password';
import { AlreadyExistsError, NotFoundError } from '../../shared/database/errors';
import { UserRepository, UserRow } from './users.repository';
import { UserCreateInput, UserUpdateInput } from './users.schema';
import { serializeUser, UserResponse } from './users.serializer';
import { ensureWalletForEmail } from '../../shared/wallet/provisioning';

/** Users business logic — orchestration only; no HTTP, no SQL. */
export class UserService extends AbstractCrudService<UserRow> {
  protected get repository(): UserRepository {
    return new UserRepository();
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    return this.repository.findByEmail(email.toLowerCase());
  }

  async findByPhone(phone: string): Promise<UserRow | null> {
    return this.repository.findByPhone(phone);
  }

  /** Creates a user with a hashed password; enforces email + phone uniqueness. */
  async createUser(input: UserCreateInput): Promise<UserResponse> {
    const email = input.email.toLowerCase();

    const emailTaken = await this.repository.findByEmail(email);
    if (emailTaken) throw new AlreadyExistsError('User', 'email');

    const phoneTaken = await this.repository.findByPhone(input.phone);
    if (phoneTaken) throw new AlreadyExistsError('User', 'phone');

    const passwordHash = await hashPassword(input.password);
    // Every new account gets an app-managed custodial wallet. If HR already
    // created an employee record for this email, reuse that wallet.
    const wallet = await ensureWalletForEmail(email);
    const user = await this.repository.create({
      ...input,
      email,
      passwordHash,
      walletAddress: wallet.address,
      walletPrivateKeyEncrypted: wallet.encryptedPrivateKey,
    });
    return serializeUser(user);
  }

  /** Profile updates never touch the password from here (dedicated change-password flow). */
  async updateUser(id: string, input: UserUpdateInput): Promise<UserResponse> {
    const existing = await this.repository.findOneById(id);
    if (!existing) throw new NotFoundError('User');

    const { password, ...rest } = input;
    void password;
    const user = await this.repository.update(id, rest);
    return serializeUser(user);
  }

  async findOneByIdSerialized(id: string): Promise<UserResponse> {
    const user = await this.repository.findOneById(id);
    if (!user) throw new NotFoundError('User');
    return serializeUser(user);
  }
}

export const usersService = new UserService();
