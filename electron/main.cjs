const { app, BrowserWindow, protocol, session, dialog } = require('electron');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { createHash } = require('node:crypto');

const smokeMode = process.env.AGENT_STUDIO_SMOKE_MODE;
const smoke = ['write', 'read'].includes(smokeMode);
app.setName('Agent Studio');
app.setPath('userData', smoke && process.env.AGENT_STUDIO_SMOKE_DIR
  ? process.env.AGENT_STUDIO_SMOKE_DIR
  : join(app.getPath('appData'), 'AgentPluginDesigner'));
protocol.registerSchemesAsPrivileged([{ scheme: 'studio', privileges: {
  standard: true, secure: true, supportFetchAPI: true,
} }]);
const home = 'studio://app/';
let win;
const single = app.requestSingleInstanceLock();
if (!single) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    // This protocol serves only the bundled entry, never arbitrary disk paths or remote code.
    const html = readFileSync(join(app.getAppPath(), 'dist', 'index.html'), 'utf8');
    const hashes = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
      .map(m => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
    const csp = `default-src 'none'; script-src ${hashes.join(' ')}; style-src 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
    protocol.handle('studio', request => {
      if (!['GET', 'HEAD'].includes(request.method) || request.url !== home) return new Response('Not found', { status: 404 });
      return new Response(request.method === 'HEAD' ? null : html, { headers: {
        'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': csp,
      } });
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.on('will-download', (_event, item) => {
      item.setSaveDialogOptions({ title: '保存 Agent Studio 导出文件' });
    });
    win = new BrowserWindow({ width: 1440, height: 1000, minWidth: 1100, minHeight: 720,
      title: 'Agent Studio · 插件设计器', backgroundColor: '#f7f8fc', autoHideMenuBar: true,
      show: !smoke,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
    });
    win.removeMenu();
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event, url) => { if (url !== home) event.preventDefault(); });
    win.webContents.on('will-redirect', event => event.preventDefault());
    win.on('closed', () => { win = null; });
    await win.loadURL(home);
    if (smoke) {
      const value = await win.webContents.executeJavaScript(`(async () => {
        const until = Date.now() + 15000;
        while (!document.querySelector('.react-flow__node') || !document.querySelector('.save-status')?.textContent.includes('已保存')) {
          if (Date.now() > until) throw Error('Desktop UI or autosave did not become ready');
          await new Promise(r => setTimeout(r, 100));
        }
        if (typeof window.require !== 'undefined') throw Error('Node integration must be disabled');
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open('agent-plugin-designer', 1);
          request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
        const tx = db.transaction('workspace', '${smokeMode === 'write' ? 'readwrite' : 'readonly'}');
        const store = tx.objectStore('workspace');
        const data = await new Promise((resolve, reject) => { const r = store.get('current'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
        if (!data?.projects?.length) throw Error('No saved project');
        ${smokeMode === 'write' ? "data.projects[0].name = 'Desktop persistence verified'; store.put(data, 'current');" : "if (data.projects[0].name !== 'Desktop persistence verified') throw Error('Persistence was not retained after restart');"}
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
        db.close(); return { mode: '${smokeMode}', nodes: document.querySelectorAll('.react-flow__node').length, persisted: true, nodeIntegration: false };
      })()`);
      writeFileSync(process.env.AGENT_STUDIO_SMOKE_RESULT, JSON.stringify(value, null, 2));
      app.exit(0);
    }
  }).catch(error => {
    if (smoke && process.env.AGENT_STUDIO_SMOKE_RESULT) writeFileSync(process.env.AGENT_STUDIO_SMOKE_RESULT, JSON.stringify({ error: error.message }));
    else dialog.showErrorBox('Agent Studio 无法启动', error.message);
    app.exit(1);
  });
  app.on('window-all-closed', () => app.quit());
}
