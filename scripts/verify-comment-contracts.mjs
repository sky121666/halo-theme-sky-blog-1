#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const classpath = process.env.SKY_UI_JAVA_FIXTURE_CLASSPATH?.trim() || process.env.THYMELEAF_TEST_CLASSPATH?.trim();

// This optional command renders production templates with supplied Java dependencies.
// It is separate from the default build and never downloads dependencies or contacts Halo.
if (!classpath) {
  console.error(
    "未运行评论模板验证：请设置 SKY_UI_JAVA_FIXTURE_CLASSPATH 或 THYMELEAF_TEST_CLASSPATH。需要 Thymeleaf、Spring、Jackson、jsoup 及其运行依赖；缺少这些依赖不能视为验证通过。",
  );
  process.exitCode = 2;
} else {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sky-comment-contracts-"));
  const fixture = path.join(root, "scripts/fixtures/CommentTemplateChecks.java");
  const executable = (name) => (process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", name) : name);
  const run = (name, args) => {
    const result = spawnSync(executable(name), args, { cwd: root, encoding: "utf8", timeout: 60_000 });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) {
      throw new Error(`评论模板验证未完成：${name} 无法运行（${result.error.message}）。`, { cause: result.error });
    }
    if (result.status !== 0) {
      throw new Error(`评论模板验证失败：${name} 退出码 ${result.status ?? result.signal}。`);
    }
  };

  try {
    run("javac", ["-encoding", "UTF-8", "-cp", classpath, "-d", directory, fixture]);
    run("java", ["-cp", `${directory}${path.delimiter}${classpath}`, "CommentTemplateChecks", root]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
