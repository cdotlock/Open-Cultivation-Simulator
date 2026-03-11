#!/usr/bin/env node

import { copyFileSync, existsSync } from "fs";
import { spawn, spawnSync } from "child_process";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const args = process.argv.slice(2);
const mode = args.includes("prod") ? "prod" : "dev";
const pnpmVersion = "10.26.2";

function log(message) {
  process.stdout.write(`[launch] ${message}\n`);
}

function fail(message) {
  process.stderr.write(`[launch] ${message}\n`);
  process.exit(1);
}

function hasCommand(command, args = ["--version"]) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "ignore",
    shell: process.platform === "win32",
  });

  return result.status === 0;
}

function runStep(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  if (result.status !== 0) {
    fail(`命令执行失败: ${command} ${args.join(" ")}`);
  }
}

async function runLong(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`命令退出，状态码 ${code ?? "unknown"}`));
    });

    child.on("error", reject);
  });
}

function ensureEnvFile() {
  const envExample = path.join(rootDir, ".env.example");
  const envLocal = path.join(rootDir, ".env.local");

  if (!existsSync(envLocal)) {
    copyFileSync(envExample, envLocal);
    log("已创建 .env.local");
  }
}

function ensurePnpm() {
  if (hasCommand("pnpm")) {
    return;
  }

  if (!hasCommand("corepack")) {
    fail("未检测到 pnpm，也无法使用 corepack。请先安装 Node.js 18+。");
  }

  log("未检测到 pnpm，正在通过 corepack 激活。");
  runStep("corepack", ["enable"]);
  runStep("corepack", ["prepare", `pnpm@${pnpmVersion}`, "--activate"]);
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write("Usage: node scripts/launch.mjs [dev|prod]\n");
    return;
  }

  log(`准备以 ${mode === "prod" ? "生产" : "开发"} 模式启动`);
  ensurePnpm();
  ensureEnvFile();

  runStep("pnpm", ["install"]);
  runStep("pnpm", ["bootstrap"]);

  if (mode === "prod") {
    runStep("pnpm", ["build"]);
    await runLong("pnpm", ["start"]);
    return;
  }

  await runLong("pnpm", ["dev"]);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "启动失败");
});
