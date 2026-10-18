import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: tsx scripts/run-sql.ts <sql-file-path>");
  process.exit(1);
}

const fullPath = path.resolve(process.cwd(), filePath);
const sqlContent = fs.readFileSync(fullPath, "utf-8");

const prisma = new PrismaClient();

async function main() {
  const statements = sqlContent
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  console.log(`Executing ${statements.length} SQL statements from ${filePath}...`);

  for (const statement of statements) {
    if (!statement) continue;
    await prisma.$executeRawUnsafe(statement);
  }

  console.log("All statements executed successfully.");
}

main()
  .catch((err) => {
    console.error("Error executing SQL:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
