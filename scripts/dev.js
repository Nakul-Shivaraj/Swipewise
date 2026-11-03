import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";

const api = spawn(npmCmd, ["run", "dev", "--workspace=@swipewise/api"], {
  stdio: "inherit",
  shell: true,
});

const web = spawn(npmCmd, ["run", "dev", "--workspace=@swipewise/web"], {
  stdio: "inherit",
  shell: true,
});

let isCleaningUp = false;
function cleanup() {
  if (isCleaningUp) return;
  isCleaningUp = true;

  if (isWindows) {
    if (api.pid) {
      try {
        spawn("taskkill", ["/pid", api.pid.toString(), "/T", "/F"]);
      } catch {
        // Process may already be dead
      }
    }
    if (web.pid) {
      try {
        spawn("taskkill", ["/pid", web.pid.toString(), "/T", "/F"]);
      } catch {
        // Process may already be dead
      }
    }
  } else {
    try {
      api.kill("SIGTERM");
    } catch {
      // Process may already be dead
    }
    try {
      web.kill("SIGTERM");
    } catch {
      // Process may already be dead
    }
  }
  process.exit();
}

api.on("exit", (code) => {
  if (code && code !== 0) {
    cleanup();
  }
});

web.on("exit", (code) => {
  if (code && code !== 0) {
    cleanup();
  }
});

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
