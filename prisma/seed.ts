import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  await prisma.notificationConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
  console.log("Seeded default notification config.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
