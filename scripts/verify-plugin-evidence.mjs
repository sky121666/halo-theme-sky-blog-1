import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { themeCodeIdentity } from "./theme-code-identity.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "sky-plugin-evidence-"));
try {
  fs.mkdirSync(path.join(root, "src"));
  fs.mkdirSync(path.join(root, "docs"));
  fs.writeFileSync(path.join(root, "src", "app.js"), "export const value = 1;\n");
  const initial = themeCodeIdentity(root);
  fs.writeFileSync(path.join(root, "docs", "test.json"), "{}");
  assert.equal(themeCodeIdentity(root).codeHash, initial.codeHash, "reports must not invalidate their own identity");
  fs.writeFileSync(path.join(root, "src", "app.js"), "export const value = 2;\n");
  assert.notEqual(themeCodeIdentity(root).codeHash, initial.codeHash, "dirty edits must invalidate prior evidence");
  fs.writeFileSync(path.join(root, "src", "app.js"), "export const value = 1;\n");
  fs.writeFileSync(path.join(root, "src", "new.js"), "export {};\n");
  assert.notEqual(themeCodeIdentity(root).codeHash, initial.codeHash, "untracked implementation must be included");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
console.log("Plugin evidence identity verified: dirty and untracked code detected; reports excluded.");
