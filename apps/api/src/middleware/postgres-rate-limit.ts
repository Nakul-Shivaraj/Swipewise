import { Store, Options, ClientRateLimitInfo } from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';

export class PostgresRateLimitStore implements Store {
  windowMs: number = 60 * 1000;
  private prisma: PrismaClient;
  private schema: string;

  constructor(prisma: PrismaClient, schema: string = 'public') {
    this.prisma = prisma;
    this.schema = schema;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const now = new Date();
    const resetTime = new Date(now.getTime() + this.windowMs);

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ total_hits: number; reset_time: Date }>
    >(
      `
      INSERT INTO "${this.schema}"."rate_limits" (key, total_hits, reset_time)
      VALUES ($1, 1, $2)
      ON CONFLICT (key) DO UPDATE
      SET
        total_hits = CASE
          WHEN "${this.schema}"."rate_limits".reset_time < $3 THEN 1
          ELSE "${this.schema}"."rate_limits".total_hits + 1
        END,
        reset_time = CASE
          WHEN "${this.schema}"."rate_limits".reset_time < $3 THEN $2
          ELSE "${this.schema}"."rate_limits".reset_time
        END
      RETURNING total_hits, reset_time;
      `,
      key,
      resetTime,
      now
    );

    const row = rows[0];
    return {
      totalHits: row.total_hits,
      resetTime: row.reset_time,
    };
  }

  async decrement(key: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `UPDATE "${this.schema}"."rate_limits" SET total_hits = GREATEST(0, total_hits - 1) WHERE key = $1`,
      key
    );
  }

  async resetKey(key: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "${this.schema}"."rate_limits" WHERE key = $1`,
      key
    );
  }

  async resetAll(): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "${this.schema}"."rate_limits"`
    );
  }
}
