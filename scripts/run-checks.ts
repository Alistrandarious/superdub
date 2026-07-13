// ponytail: discovers *.check.ts under src/ and server/ and runs each with tsx.
// Ceiling: synchronous, one process per file — fine at 13 files, revisit if this grows large.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SKIP_DIRS = new Set(["node_modules", ".claude"]);

function findCheckFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...findCheckFiles(full));
    } else if (entry.endsWith(".check.ts")) {
      results.push(full);
    }
  }
  return results;
}

const files = [...findCheckFiles("src"), ...findCheckFiles("server")].sort();
const tsxCli = require.resolve("tsx/cli");
const failures: string[] = [];

for (const file of files) {
  console.log(`> ${file}`);
  const result = spawnSync(process.execPath, [tsxCli, file], { stdio: "inherit" });
  if (result.status !== 0) failures.push(file);
}

if (failures.length > 0) {
  console.error(`\n${failures.length}/${files.length} checks failed:`);
  for (const file of failures) console.error(`  ${file}`);
  process.exit(1);
}

console.log(`\nAll ${files.length} checks passed.`);
