// ensure-rolldown-binding.mjs
// npm has a long-standing bug (npm/cli#4828) where optional native bindings
// (e.g. @rolldown/binding-*) are not installed on some platforms/versions.
// This postinstall hook ensures the current platform's binding exists,
// installing it with --no-save so package.json stays clean and cross-platform.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

const bindingByPlatform = {
  win32: { x64: "@rolldown/binding-win32-x64-msvc", arm64: "@rolldown/binding-win32-arm64-msvc" },
  linux: { x64: "@rolldown/binding-linux-x64-gnu", arm64: "@rolldown/binding-linux-arm64-gnu" },
  darwin: { x64: "@rolldown/binding-darwin-x64", arm64: "@rolldown/binding-darwin-arm64" },
};

const pkg = bindingByPlatform[os.platform()]?.[os.arch()];
if (!pkg) {
  console.log(`ensure-rolldown-binding: no binding needed for ${os.platform()}-${os.arch()}`);
  process.exit(0);
}

const installed = existsSync(join("node_modules", pkg));
if (installed) {
  console.log(`ensure-rolldown-binding: ${pkg} already present`);
  process.exit(0);
}

console.log(`ensure-rolldown-binding: installing ${pkg} (npm optional-deps workaround)`);
const r = spawnSync("npm", ["install", "--no-save", "--ignore-scripts", pkg], {
  stdio: "inherit",
  shell: os.platform() === "win32",
});
process.exit(r.status ?? 1);
