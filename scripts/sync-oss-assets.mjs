import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "src");
const OUTPUT_DIR = path.join(ROOT, "public", "assets");
const ASSET_BASE_URL = "https://mobai-file.oss-cn-shanghai.aliyuncs.com/assets";

async function walk(dir) {
  const entries = await (await import("fs/promises")).readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return walk(fullPath);
      }
      return fullPath;
    }),
  );
  return files.flat();
}

function collectAssetIds(source) {
  const regex = /\$img\((["'])(.*?)\1\)/g;
  const assets = [];
  let match;
  while ((match = regex.exec(source)) !== null) {
    assets.push(match[2]);
  }
  return assets;
}

async function downloadToFile(url, filePath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, Buffer.from(arrayBuffer));
}

const files = (await walk(SOURCE_DIR)).filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));
const assetIds = new Set();

for (const file of files) {
  const content = await readFile(file, "utf8");
  for (const assetId of collectAssetIds(content)) {
    assetIds.add(assetId);
  }
}

assetIds.add("bgm");

for (const assetId of [...assetIds].sort()) {
  const extension = assetId === "bgm" ? "mp3" : "webp";
  const outputPath = path.join(OUTPUT_DIR, `${assetId}.${extension}`);
  const url = `${ASSET_BASE_URL}/${assetId}.${extension}`;

  try {
    await downloadToFile(url, outputPath);
    console.log(`synced ${assetId}.${extension}`);
  } catch (error) {
    console.warn(`failed ${assetId}.${extension}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
