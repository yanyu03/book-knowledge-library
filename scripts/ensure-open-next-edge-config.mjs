import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const projectRoot = process.cwd();
const outputPath = path.join(projectRoot, ".open-next", ".build", "open-next.config.edge.mjs");

if (!fs.existsSync(outputPath)) {
  const tempConfig = fs.readdirSync(os.tmpdir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("open-next-tmp"))
    .map((entry) => path.join(os.tmpdir(), entry.name))
    .filter((directory) => fs.existsSync(path.join(directory, "open-next.config.edge.mjs")))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0];

  if (tempConfig) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.copyFileSync(path.join(tempConfig, "open-next.config.edge.mjs"), outputPath);
  }
}
