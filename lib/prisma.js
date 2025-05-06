import { PrismaClient } from '@prisma/client';

// Use a single instance of Prisma Client across the whole application
const globalForPrisma = global;

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;