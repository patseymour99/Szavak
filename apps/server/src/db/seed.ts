import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FAMILY: Array<{ name: string; color: string; isAdmin?: boolean }> = [
  { name: "Andi", color: "#ef4444", isAdmin: true },
  { name: "Blancica", color: "#f59e0b" },
  { name: "Pat", color: "#10b981" },
  { name: "Robi", color: "#3b82f6" },
  { name: "Marcsi", color: "#8b5cf6" },
  { name: "Jazi", color: "#ec4899" },
  { name: "Zsolesz", color: "#14b8a6" },
];

async function main() {
  for (const member of FAMILY) {
    const existing = await prisma.profile.findUnique({ where: { name: member.name } });
    if (existing) continue;
    await prisma.profile.create({
      data: {
        name: member.name,
        // Empty pinHash means "PIN not set yet"; the picker will show a setup form.
        pinHash: "",
        color: member.color,
        isAdmin: member.isAdmin ?? false,
      },
    });
    console.log(`seeded profile: ${member.name}${member.isAdmin ? " (admin)" : ""}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
