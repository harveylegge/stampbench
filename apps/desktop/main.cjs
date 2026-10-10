const { app, BrowserWindow, shell } = require('electron');
const { createServer } = require('node:http');
const { createReadStream, existsSync, statSync } = require('node:fs');
const { extname, join, normalize, resolve } = require('node:path');

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

let staticServer;

function resolveAsset(root, requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, 'http://127.0.0.1').pathname);
  const relative = pathname === '/' ? 'desktop/index.html' : pathname.replace(/^\/+/, '');
  const initial = resolve(root, normalize(relative));
  if (!initial.startsWith(resolve(root))) return null;
  if (existsSync(initial) && statSync(initial).isDirectory()) return join(initial, 'index.html');
  if (existsSync(initial)) return initial;
  const withIndex = join(initial, 'index.html');
  return existsSync(withIndex) ? withIndex : null;
}

function startStaticServer(root) {
  return new Promise((resolveServer, reject) => {
    staticServer = createServer((request, response) => {
      const asset = resolveAsset(root, request.url || '/');
      if (!asset) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': MIME[extname(asset)] || 'application/octet-stream',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      });
      createReadStream(asset).pipe(response);
    });
    staticServer.once('error', reject);
    staticServer.listen(0, '127.0.0.1', () => resolveServer(staticServer.address().port));
  });
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: '#d8d2c6',
    title: 'Stampbench',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  window.once('ready-to-show', () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    const allowed = url.startsWith('http://127.0.0.1:') || url.startsWith('http://localhost:4180');
    if (!allowed) {
      event.preventDefault();
      if (url.startsWith('https://')) void shell.openExternal(url);
    }
  });

  if (!app.isPackaged) {
    await window.loadURL(process.env.STAMPBENCH_DESKTOP_DEV_URL || 'http://localhost:4180/desktop?platform=windows');
  } else {
    const webRoot = join(process.resourcesPath, 'web');
    const port = await startStaticServer(webRoot);
    await window.loadURL(`http://127.0.0.1:${port}/desktop/`);
  }

}

app.whenReady().then(async () => {
  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => staticServer?.close());
