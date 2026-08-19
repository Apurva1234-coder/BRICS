import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [];
let stopping = false;

function run(label, args, env) {
  const child = spawn(npm, args, { stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, ...env } });
  children.push(child);
  child.on("exit", (code) => {
    if (!stopping && code !== 0) stop(code || 1);
  });
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 250).unref();
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
console.log("CleanAir stack: frontend http://127.0.0.1:5173, backend http://127.0.0.1:8787");
run("backend", ["run", "server:dev"], { PORT: "8787", NODE_ENV: "development", LOCAL_DEMO_MODE: "true", ENABLE_FIREBASE_STORAGE: "false" });
run("frontend", ["run", "dev"], { VITE_API_BASE_URL: "", VITE_ENABLE_DEMO_RESOLUTION_DATA: "true" });
