import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  // Keep route modules loadable so missing configuration can be returned as a
  // structured API error instead of Next.js generating an HTML error page.
  const connectionString = process.env.DATABASE_URL ?? 'postgresql://unconfigured:unconfigured@127.0.0.1:1/unconfigured';
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
