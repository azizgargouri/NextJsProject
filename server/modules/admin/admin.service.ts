import type { UserStatus } from '../../shared/database/enums';
import { BadRequestError } from '../../shared/database/errors';
import { isValidObjectId } from 'mongoose';
import { adminRepository } from './admin.repository';
import { AuthRepository } from '../auth/auth.repository';
import { usersService } from '../users/users.service';
import type { ManagedUserCreateInput, ManagedUserUpdateInput } from '../users/users.schema';

export class AdminService {
  private readonly tokens = new AuthRepository();

  getOverview() {
    return adminRepository.getOverview();
  }

  listUsers(searchParams: URLSearchParams) {
    return usersService.findPaginated(searchParams);
  }

  getUser(userId: string) {
    this.assertUserId(userId);
    return usersService.findOneByIdSerialized(userId);
  }

  createUser(input: ManagedUserCreateInput) {
    return usersService.createManagedUser(input);
  }

  async updateUser(actorId: string, userId: string, input: ManagedUserUpdateInput) {
    this.assertUserId(userId);
    if (actorId === userId && input.status === 'BLOCKED') {
      throw new BadRequestError('You cannot block your own admin account');
    }
    if (actorId === userId && input.role && input.role !== 'ADMIN') {
      throw new BadRequestError('You cannot remove your own admin role');
    }

    const existing = await usersService.findOneByIdSerialized(userId);
    const user = await usersService.updateManagedUser(userId, input);
    const securityChanged =
      Boolean(input.password) ||
      (input.role !== undefined && input.role !== existing.role) ||
      input.status === 'BLOCKED';
    if (securityChanged) await this.tokens.revokeAllForUser(userId);
    return user;
  }

  async deleteUser(actorId: string, userId: string) {
    this.assertUserId(userId);
    if (actorId === userId) throw new BadRequestError('You cannot delete your own admin account');
    const user = await usersService.deleteManagedUser(userId);
    await this.tokens.revokeAllForUser(userId);
    return user;
  }

  async setUserStatus(actorId: string, userId: string, status: UserStatus) {
    this.assertUserId(userId);
    if (actorId === userId && status === 'BLOCKED') {
      throw new BadRequestError('You cannot block your own admin account');
    }
    const user = await usersService.setStatus(userId, status);
    if (status === 'BLOCKED') await this.tokens.revokeAllForUser(userId);
    return user;
  }

  private assertUserId(userId: string) {
    if (!isValidObjectId(userId)) throw new BadRequestError('Invalid user ID');
  }
}

export const adminService = new AdminService();
