// Dependency-free syntax check on Windows, macOS and Linux.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const skip = new Set(['.git', 'node_modules', 'data', 'workspace', 'backups']);
let count = 0;
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(item.name)) continue;
    const file = path.join(dir, item.name);
    if (item.isDirectory()) walk(file);
    else if (item.isFile() && /\.(mjs|js)$/.test(file)) {
      const r = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
      if (r.status !== 0 || r.error) process.exit(1);
      count++;
    }
  }
}
walk(root);
console.log(`Syntax checked ${count} JavaScript files.`);
