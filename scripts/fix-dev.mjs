import { rmSync } from "fs";
import { execSync } from "child_process";

function log(msg) {
  console.log(`[signalforge] ${msg}`);
}

try {
  rmSync(".next", { recursive: true, force: true });
  log("Removed .next cache");
} catch {
  log("No .next folder to remove");
}

function killPort(port) {
  if (process.platform === "win32") {
    try {
      execSync(
        `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`,
        { stdio: "ignore", shell: "powershell.exe" },
      );
    } catch {
      /* port free */
    }
    return;
  }
  try {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, { stdio: "ignore" });
  } catch {
    /* port free */
  }
}

for (const port of [3000, 3001, 3002]) {
  killPort(port);
}
log("Freed ports 3000–3002");
log("Tip: run only ONE dev server (npm run dev). Multiple servers corrupt .next on Windows.");
log("Run: npm run dev");