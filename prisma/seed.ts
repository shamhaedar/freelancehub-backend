import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { UserRole } from '../src/common/Enums/index.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL or ADMIN_PASSWORD is missing');
  }
  if (password.length < 8 || password.length > 72) {
    throw new Error('ADMIN_PASSWORD must be between 8 and 72 characters');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: UserRole.ADMIN, password: passwordHash, isBanned: false },
    create: { email, password: passwordHash, name: 'admin', role: UserRole.ADMIN },
    omit: { password: true },
  });


  await prisma.wallet.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id },
  });


  await prisma.session.updateMany({
    where: { userId: admin.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  console.log('Admin account ready:', admin);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });