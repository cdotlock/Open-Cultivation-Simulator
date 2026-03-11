import "server-only";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const GENERATED_DIR = path.join(process.cwd(), "public", "generated");

export async function saveBufferToPublicFile(
  buffer: Buffer,
  folder: string,
  extension = "png",
) {
  const targetDir = path.join(GENERATED_DIR, folder);
  await mkdir(targetDir, { recursive: true });

  const fileName = `${randomUUID()}.${extension}`;
  const filePath = path.join(targetDir, fileName);
  await writeFile(filePath, buffer);

  return `/generated/${folder}/${fileName}`;
}

