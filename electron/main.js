"use strict";

const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

const PORT = 3000;
const HOSTNAME = "127.0.0.1";

let nextServer = null;
let win = null;

// ── environment detection ─────────────────────────────────────────────────────

const isDev = !app.isPackaged;

// In dev: run `next start` inside the frontend directory
// In packaged: run `node server.js` from the bundled standalone output
const frontendDir = isDev
  ? path.join(__dirname, "..", "frontend")
  : null;

const standaloneServerPath = isDev
  ? null
  : path.join(process.resourcesPath, "app", "server.js");

// ── Next.js server ────────────────────────────────────────────────────────────

function startServer() {
  if (isDev) {
    // Dev: spawn `npm start` in the frontend source directory.
    // `npm` resolves to the system npm, not the Electron binary — safe to spawn.
    nextServer = spawn(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["start", "--", "-p", String(PORT)],
      {
        cwd: frontendDir,
        env: { ...process.env, PORT: String(PORT), HOSTNAME, NODE_ENV: "production" },
        stdio: "pipe",
      }
    );
    nextServer.stdout?.on("data", (d) => process.stdout.write(`[next] ${d}`));
    nextServer.stderr?.on("data", (d) => process.stderr.write(`[next] ${d}`));
    nextServer.on("error", (err) =>
      console.error("[electron] Failed to start Next.js:", err.message)
    );
  } else {
    // Packaged: require() server.js directly in this process.
    // DO NOT spawn(process.execPath, ...) — in a packaged Electron app,
    // process.execPath IS the .app binary, so spawning it would launch another
    // Electron instance, which spawns another, ad infinitum.
    // Electron's main process is Node.js, so require() works fine here.
    Object.assign(process.env, {
      PORT: String(PORT),
      HOSTNAME,
      NODE_ENV: "production",
    });
    require(standaloneServerPath);
    // server.js registers its HTTP listener synchronously; polling confirms readiness.
  }

  // Poll until the server accepts a connection
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      http
        .get(`http://${HOSTNAME}:${PORT}`, () => {
          clearInterval(interval);
          resolve();
        })
        .on("error", () => {
          // Not ready yet — keep polling
        });
    }, 300);
  });
}

// ── window ────────────────────────────────────────────────────────────────────

async function createWindow() {
  console.log("[electron] Starting Next.js server...");
  await startServer();
  console.log(`[electron] Server ready on http://${HOSTNAME}:${PORT}`);

  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 15 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(`http://${HOSTNAME}:${PORT}`);

  // Open external links in the system browser, not inside Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.on("closed", () => {
    win = null;
  });
}

// ── app lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(createWindow);

app.on("activate", () => {
  // macOS: re-open the window when the dock icon is clicked and no windows are open
  if (!win) createWindow();
});

app.on("window-all-closed", () => {
  killServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", killServer);

function killServer() {
  if (nextServer) {
    nextServer.kill();
    nextServer = null;
  }
}
