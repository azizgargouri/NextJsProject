import { AbstractCrudService } from '../../shared/database/crud-service';
import { hashPassword } from '../../shared/auth/password';
import { AlreadyExistsError, NotFoundError } from '../../shared/database/errors';
import { UserRepository, UserRow } from './users.repository';
import {
  type ManagedUserCreateInput,
  type ManagedUserUpdateInput,
  type UserCreateInput,
  type UserUpdateInput,
} from './users.schema';
import { serializeUser, UserResponse } from './users.serializer';
import type { UserStatus } from '../../shared/database/enums';
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

    const emailTaken = await this.repository.findAnyByEmail(email);
    if (emailTaken) throw new AlreadyExistsError('User', 'email');

    const phoneTaken = await this.repository.findAnyByPhone(input.phone);
    if (phoneTaken) throw new AlreadyExistsError('User', 'phone');

    const { password, ...account } = input;
    const passwordHash = await hashPassword(password);
    const wallet = await ensureWalletForEmail(email);
    const user = await this.repository.create({
      ...account,
      email,
      passwordHash,
      walletAddress: wallet.address,
      walletPrivateKeyEncrypted: wallet.encryptedPrivateKey,
    });
    return serializeUser(user);
  }

  async createManagedUser(input: ManagedUserCreateInput): Promise<UserResponse> {
    const email = input.email.toLowerCase();
    if (await this.repository.findAnyByEmail(email)) throw new AlreadyExistsError('User', 'email');
    if (await this.repository.findAnyByPhone(input.phone)) {
      throw new AlreadyExistsError('User', 'phone');
    }

    const { password, ...account } = input;
    const passwordHash = await hashPassword(password);
    const wallet = await ensureWalletForEmail(email);
    return serializeUser(
      await this.repository.create({
        ...account,
        email,
        passwordHash,
        walletAddress: wallet.address,
        walletPrivateKeyEncrypted: wallet.encryptedPrivateKey,
      }),
    );
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
    if (!user || user.deletedAt) throw new NotFoundError('User');
    return serializeUser(user);
  }

  async findPaginated(searchParams: URLSearchParams) {
    const page = await this.repository.findPaginated(searchParams);
    return { ...page, data: page.data.map(serializeUser) };
  }

  async setStatus(id: string, status: UserStatus): Promise<UserResponse> {
    const existing = await this.repository.findOneById(id);
    if (!existing || existing.deletedAt) throw new NotFoundError('User');
    return serializeUser(await this.repository.update(id, { status }));
  }

  async updateManagedUser(id: string, input: ManagedUserUpdateInput): Promise<UserResponse> {
    const existing = await this.repository.findOneById(id);
    if (!existing || existing.deletedAt) throw new NotFoundError('User');

    const data: Record<string, unknown> = { ...input };
    if (input.email) {
      const email = input.email.toLowerCase();
      const owner = await this.repository.findAnyByEmail(email);
      if (owner && owner.id !== id) throw new AlreadyExistsError('User', 'email');
      data.email = email;
    }
    if (input.phone) {
      const owner = await this.repository.findAnyByPhone(input.phone);
      if (owner && owner.id !== id) throw new AlreadyExistsError('User', 'phone');
    }
    if (input.password) data.passwordHash = await hashPassword(input.password);
    delete data.password;

    return serializeUser(await this.repository.update(id, data));
  }

  async deleteManagedUser(id: string): Promise<UserResponse> {
    const existing = await this.repository.findOneById(id);
    if (!existing || existing.deletedAt) throw new NotFoundError('User');
    return serializeUser(await this.repository.delete(id));
  }
}

export const usersService = new UserService();
