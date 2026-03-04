#!/usr/bin/env bun

import fs from "fs"
import os from "os"
import path from "path"
import { fileURLToPath } from "url"

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

process.chdir(dir)

const args = process.argv.slice(2)
const bad = args.find((item) => item !== "--baseline")

if (bad) {
  console.error(`Unknown option: ${bad}`)
  console.error("Usage: bun run install:local-binary [-- --baseline]")
  process.exit(1)
}

const baseline = args.includes("--baseline")

function target(flag: boolean) {
  const osName =
    process.platform === "darwin" ? "darwin" : process.platform === "linux" ? "linux" : process.platform === "win32" ? "windows" : ""

  if (!osName) {
    console.error(`Unsupported platform: ${process.platform}`)
    process.exit(1)
  }

  if (process.arch !== "arm64" && process.arch !== "x64") {
    console.error(`Unsupported architecture: ${process.arch}`)
    process.exit(1)
  }

  return `opencode-${osName}-${process.arch}${flag && process.arch === "x64" ? "-baseline" : ""}`
}

const build = [process.execPath, path.join(dir, "packages", "opencode", "script", "build.ts"), "--single"]

if (baseline) build.push("--baseline")

const code = await Bun.spawn(build, {
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
}).exited

if (code !== 0) process.exit(code)

const file = process.platform === "win32" ? "opencode.exe" : "opencode"
const out = path.join(dir, "packages", "opencode", "dist", target(baseline), "bin", file)
const alt = file === "opencode.exe" ? path.join(dir, "packages", "opencode", "dist", target(baseline), "bin", "opencode") : out
const src = fs.existsSync(out) ? out : alt

if (!fs.existsSync(src)) {
  console.error(`Built binary not found at ${out}`)
  process.exit(1)
}

const dst = path.join(os.homedir(), ".opencode", "bin", file)

await fs.promises.mkdir(path.dirname(dst), { recursive: true })
await Bun.write(dst, Bun.file(src))
await fs.promises.chmod(dst, 0o755)

console.log(`Installed local opencode binary from ${src} to ${dst}`)
console.log("Re-run `bun run install:local-binary` after changing this fork.")
