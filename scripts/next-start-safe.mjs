import { spawn } from "node:child_process";
import { resolve } from "node:path";

const nextBin = resolve("node_modules/next/dist/bin/next");
const preload = resolve("scripts/ignore-client-abort.cjs");
const nodeOptions = [process.env.NODE_OPTIONS, `--require=${preload}`]
  .filter(Boolean)
  .join(" ");

const child = spawn(
  process.execPath,
  [nextBin, "start", ...process.argv.slice(2)],
  {
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
    stdio: "inherit",
  },
);

const exit = (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
};

child.on("exit", exit);
child.on("error", (error) => {
  console.error("Failed to start Next.js:", error);
  process.exit(1);
});
