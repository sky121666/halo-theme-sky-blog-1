import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

// Include uncommitted/untracked implementation and generated assets. Reports are
// excluded so writing test evidence does not change the code being identified.
const inputs = [
  "src",
  "templates",
  "scripts",
  "package.json",
  "pnpm-lock.yaml",
  "theme.yaml",
  "settings.yaml",
  "annotation-setting.yaml",
  "vite.config.ts",
  "postcss.config.cjs",
  "tsconfig.json",
  "tsconfig.node.json",
];

export function themeCodeIdentity(root = process.cwd()) {
  const files = [];
  function visit(relative) {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) return;
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Code identity cannot follow symlink: ${relative}`);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute)) visit(path.join(relative, name));
    } else if (stat.isFile()) {
      files.push(relative);
    }
  }
  inputs.forEach(visit);
  const hash = createHash("sha256");
  for (const relative of files.sort()) {
    const fileHash = createHash("sha256")
      .update(fs.readFileSync(path.join(root, relative)))
      .digest("hex");
    hash.update(`${relative.split(path.sep).join("/")}\0${fileHash}\n`);
  }
  let baseCommit = null;
  try {
    baseCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    /* Standalone source archives may not have Git metadata. */
  }
  return { algorithm: "sha256", codeHash: hash.digest("hex"), fileCount: files.length, baseCommit, inputs };
}
