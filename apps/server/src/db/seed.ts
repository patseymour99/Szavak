import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.profile.count();
  if (count > 0) {
    console.log(`Skipping seed: ${count} profiles already exist.`);
    return;
  }
  const pinHash = await bcrypt.hash("1234", 8);
  await prisma.profile.create({
    data: { name: "Admin", pinHash, color: "#3b82f6", isAdmin: true },
  });
  console.log("Seeded admin profile (name: Admin, PIN: 1234). Change after first login!");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
