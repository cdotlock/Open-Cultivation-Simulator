import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { spawnSync } from "child_process";

const root = process.cwd();
const tempDir = path.join(root, ".tmp");
const sqlPath = path.join(tempDir, "prisma-init.sql");

await mkdir(tempDir, { recursive: true });

const diff = spawnSync(
  "pnpm",
  [
    "prisma",
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script",
  ],
  {
    cwd: root,
    encoding: "utf8",
  },
);

if (diff.status !== 0) {
  process.stderr.write(diff.stderr || diff.stdout);
  process.exit(diff.status || 1);
}

await writeFile(sqlPath, diff.stdout, "utf8");

const execute = spawnSync(
  "pnpm",
  ["prisma", "db", "execute", "--file", sqlPath, "--schema", "prisma/schema.prisma"],
  {
    cwd: root,
    stdio: "inherit",
  },
);

process.exit(execute.status || 0);

