#!/usr/bin/env node

import { existsSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";

const rootDir = process.cwd();
const databasePath = path.join(rootDir, "prisma", "dev.db");
const assetProbe = path.join(rootDir, "public", "assets", "logo2.webp");

function runStep(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

runStep("pnpm", ["prisma", "generate"]);

if (!existsSync(databasePath)) {
  runStep("node", ["scripts/init-sqlite.mjs"]);
}

if (!existsSync(assetProbe)) {
  runStep("node", ["scripts/sync-oss-assets.mjs"]);
}
