import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const classpath = process.env.THYMELEAF_TEST_CLASSPATH?.trim();
if (!classpath) {
  console.error(
    "未运行模板数据验证：请设置 THYMELEAF_TEST_CLASSPATH（Thymeleaf、Spring、jsoup 及运行依赖）。不会自动下载依赖。",
  );
  process.exitCode = 2;
} else {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sky-template-data-"));
  try {
    for (const [command, args] of [
      [
        "javac",
        [
          "-encoding",
          "UTF-8",
          "-cp",
          classpath,
          "-d",
          directory,
          path.join(root, "scripts/fixtures/TemplateDataChecks.java"),
        ],
      ],
      ["java", ["-cp", `${directory}${path.delimiter}${classpath}`, "TemplateDataChecks", root]],
    ]) {
      const executable = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", command) : command;
      const result = spawnSync(executable, args, { cwd: root, encoding: "utf8", timeout: 60_000 });
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`${command} 退出码 ${result.status ?? result.signal}`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
