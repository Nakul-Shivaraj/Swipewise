import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";
const repoRoot = path.resolve(__dirname, "../../..");

describe("API dev server (Issue #34)", () => {
  it("AC1: root package.json dev script starts both api and web workspaces", () => {
    const rootPkgPath = path.join(repoRoot, "package.json");
    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf-8"));
    const devScriptPath = path.join(repoRoot, "scripts/dev.js");
    expect(fs.existsSync(devScriptPath)).toBe(true);
    expect(rootPkg.scripts.dev).toContain("scripts/dev.js");
  });

  it("AC2: API server starts via dev script and responds to /api/health", async () => {
    const port = "3199";
    const child = spawn(npmCmd, ["run", "dev", "--workspace=@swipewise/api"], {
      cwd: repoRoot,
      env: { ...process.env, PORT: port },
      shell: true,
    });

    try {
      let responded = false;
      let errorOutput = "";

      child.stderr?.on("data", (d) => {
        errorOutput += d.toString();
      });
      child.stdout?.on("data", (d) => {
        errorOutput += d.toString();
      });

      const startTime = Date.now();
      while (Date.now() - startTime < 12000) {
        if (child.exitCode !== null) {
          throw new Error(
            `Dev server process exited prematurely with code ${child.exitCode}: ${errorOutput}`,
          );
        }
        try {
          const res = await fetch(`http://127.0.0.1:${port}/api/health`);
          if (res.ok) {
            const data = await res.json();
            expect(data).toEqual({ status: "ok", db: "ok" });
            responded = true;
            break;
          }
        } catch {
          // Wait and retry
        }
        await new Promise((r) => setTimeout(r, 400));
      }

      expect(responded).toBe(true);
    } finally {
      if (isWindows && child.pid) {
        try {
          spawn("taskkill", ["/pid", child.pid.toString(), "/T", "/F"]);
        } catch {
          // Ignore if process already dead
        }
      } else {
        child.kill("SIGTERM");
      }
    }
  }, 15000);
});
