import { PrismaClient, User, Address, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { logger } from '../utils/logger';
import { publishEvent } from '../utils/kafka';
import { cacheGet, cacheSet, cacheDelete, cacheDeletePattern } from '../utils/redis';

const prisma = new PrismaClient();

const USER_CACHE_TTL = 300; // 5 minutes
const USER_CACHE_PREFIX = 'user:';

export interface CreateUserDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface UpdateUserDTO {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
}

export interface CreateAddressDTO {
  label?: string;
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  isDefault?: boolean;
}

type UserWithoutPassword = Omit<User, 'passwordHash'>;

function excludePassword(user: User): UserWithoutPassword {
  const { passwordHash: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

export class UserService {
  async createUser(data: CreateUserDTO): Promise<UserWithoutPassword> {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    const passwordHash = await bcrypt.hash(data.password, config.bcrypt.saltRounds);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      },
    });

    logger.info('User created', { userId: user.id, email: user.email });

    await publishEvent('user-events', {
      type: 'UserRegistered',
      payload: {
        userId: user.id,
        email: user.email,
        registeredAt: user.createdAt.toISOString(),
      },
    }).catch((err) => {
      logger.error('Failed to publish UserRegistered event', { error: err.message });
    });

    return excludePassword(user);
  }

  async getUserById(id: string): Promise<UserWithoutPassword | null> {
    const cacheKey = `${USER_CACHE_PREFIX}${id}`;
    const cached = await cacheGet<UserWithoutPassword>(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) return null;

    const userWithoutPassword = excludePassword(user);
    await cacheSet(cacheKey, userWithoutPassword, USER_CACHE_TTL);

    return userWithoutPassword;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async updateUser(id: string, data: UpdateUserDTO): Promise<UserWithoutPassword> {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    await cacheDelete(`${USER_CACHE_PREFIX}${id}`);

    logger.info('User updated', { userId: id });

    await publishEvent('user-events', {
      type: 'UserUpdated',
      payload: {
        userId: id,
        updatedFields: Object.keys(data),
        updatedAt: new Date().toISOString(),
      },
    }).catch((err) => {
      logger.error('Failed to publish UserUpdated event', { error: err.message });
    });

    return excludePassword(user);
  }

  async deleteUser(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id },
    });

    await cacheDelete(`${USER_CACHE_PREFIX}${id}`);

    logger.info('User deleted', { userId: id });

    await publishEvent('user-events', {
      type: 'UserDeleted',
      payload: {
        userId: id,
        deletedAt: new Date().toISOString(),
      },
    }).catch((err) => {
      logger.error('Failed to publish UserDeleted event', { error: err.message });
    });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async updateLastLogin(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
    await cacheDelete(`${USER_CACHE_PREFIX}${id}`);
  }

  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, config.bcrypt.saltRounds);
    await prisma.user.update({
      where: { id },
      data: { passwordHash: newPasswordHash },
    });

    await cacheDelete(`${USER_CACHE_PREFIX}${id}`);
    logger.info('Password changed', { userId: id });
  }

  // Address management
  async getAddresses(userId: string): Promise<Address[]> {
    return prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAddress(userId: string, data: CreateAddressDTO): Promise<Address> {
    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.address.create({
      data: {
        userId,
        ...data,
      },
    });
  }

  async updateAddress(
    userId: string,
    addressId: string,
    data: Partial<CreateAddressDTO>
  ): Promise<Address> {
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new Error('Address not found');
    }

    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.address.update({
      where: { id: addressId },
      data,
    });
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new Error('Address not found');
    }

    await prisma.address.delete({
      where: { id: addressId },
    });
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<Address> {
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new Error('Address not found');
    }

    await prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    return prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    });
  }
}

export const userService = new UserService();
