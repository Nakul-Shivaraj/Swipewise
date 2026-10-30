import { PrismaClient, User } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client.js';

export type UserRecord = User;

export class UserRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient = defaultPrisma) {
    this.prisma = prisma;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    return this.prisma.user.findUnique({
      where: { email: normalized },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(data: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        passwordHash: data.passwordHash,
      },
    });
  }

  async clear(): Promise<void> {
    await this.prisma.user.deleteMany();
  }
}

export const userRepo = new UserRepository();
