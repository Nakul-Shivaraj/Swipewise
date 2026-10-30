import crypto from 'node:crypto';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

const users: UserRecord[] = [];

export const userRepo = {
  findByEmail(email: string): UserRecord | undefined {
    const normalized = email.trim().toLowerCase();
    return users.find((u) => u.email.toLowerCase() === normalized);
  },

  create(data: Omit<UserRecord, 'id' | 'createdAt'>): UserRecord {
    const record: UserRecord = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email.trim().toLowerCase(),
      passwordHash: data.passwordHash,
      createdAt: new Date(),
    };
    users.push(record);
    return record;
  },

  clear() {
    users.length = 0;
  },
};
