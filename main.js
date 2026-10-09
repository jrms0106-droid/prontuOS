'use strict';

const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, shell, nativeImage } = require('electron');
const path = require('path');
const { Storage } = require('./storage');

let janela = null;
let bandeja = null;
let storage = null;
let saindo = false;

// Apenas uma instância do ProntuOS por computador/usuário.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', mostrarJanela);
  app.whenReady().then(iniciar);
}

function iniciar() {
  // Os dados ficam na pasta de dados do usuário do sistema operacional:
  //   Windows: %APPDATA%\ProntuOS   macOS: ~/Library/Application Support/ProntuOS
  //   Linux:   ~/.config/ProntuOS
  storage = new Storage(app.getPath('userData'));
  storage.backupDiario();

  registrarIpc();
  criarMenu();
  criarJanela();
  criarBandeja();

  app.on('activate', mostrarJanela);
}

function criarJanela() {
  const abertoComSistema = app.getLoginItemSettings().wasOpenedAtLogin || process.argv.includes('--oculto');

  janela = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'ProntuOS',
    show: !abertoComSistema,
    icon: path.join(__dirname, 'src', 'icone.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  janela.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Fechar a janela mantém o app na bandeja do sistema; "Sair" encerra de fato.
  janela.on('close', (e) => {
    if (!saindo && bandeja) {
      e.preventDefault();
      janela.hide();
    }
  });

  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function mostrarJanela() {
  if (!janela) return criarJanela();
  if (janela.isMinimized()) janela.restore();
  janela.show();
  janela.focus();
}

function sair() {
  saindo = true;
  app.quit();
}

function criarBandeja() {
  try {
    const icone = nativeImage.createFromPath(path.join(__dirname, 'src', 'icone.png')).resize({ width: 16, height: 16 });
    bandeja = new Tray(icone);
  } catch {
    bandeja = null; // Alguns ambientes Linux não têm bandeja.
    return;
  }
  bandeja.setToolTip('ProntuOS');
  bandeja.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir ProntuOS', click: mostrarJanela },
      { type: 'separator' },
      { label: 'Sair', click: sair },
    ])
  );
  bandeja.on('click', mostrarJanela);
}

function criarMenu() {
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Novo paciente', accelerator: 'CmdOrCtrl+N', click: () => enviar('menu:novo-paciente') },
        { type: 'separator' },
        { label: 'Exportar backup…', click: exportarBackup },
        { label: 'Importar backup…', click: importarBackup },
        { label: 'Abrir pasta de dados', click: () => shell.openPath(app.getPath('userData')) },
        { type: 'separator' },
        { label: 'Sair', accelerator: 'CmdOrCtrl+Q', click: sair },
      ],
    },
    {
      label: 'Sistema',
      submenu: [
        {
          label: 'Iniciar com o computador',
          type: 'checkbox',
          checked: app.getLoginItemSettings().openAtLogin,
          click: (item) => definirInicioAutomatico(item.checked),
        },
      ],
    },
    { label: 'Editar', role: 'editMenu' },
    { label: 'Exibir', role: 'viewMenu' },
  ];
  if (process.platform === 'darwin') template.unshift({ role: 'appMenu' });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function definirInicioAutomatico(ativo) {
  app.setLoginItemSettings({ openAtLogin: ativo, openAsHidden: true, args: ['--oculto'] });
  return app.getLoginItemSettings().openAtLogin;
}

function enviar(canal, ...args) {
  mostrarJanela();
  janela.webContents.send(canal, ...args);
}

async function exportarBackup() {
  const dia = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog(janela, {
    title: 'Exportar backup do ProntuOS',
    defaultPath: path.join(app.getPath('documents'), `prontuos-backup-${dia}.json`),
    filters: [{ name: 'Backup ProntuOS', extensions: ['json'] }],
  });
  if (canceled || !filePath) return false;
  storage.exportar(filePath);
  return true;
}

async function importarBackup() {
  const { canceled, filePaths } = await dialog.showOpenDialog(janela, {
    title: 'Importar backup do ProntuOS',
    filters: [{ name: 'Backup ProntuOS', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return false;
  const { response } = await dialog.showMessageBox(janela, {
    type: 'warning',
    buttons: ['Cancelar', 'Substituir dados'],
    defaultId: 0,
    cancelId: 0,
    message: 'Importar este backup substituirá todos os dados atuais.',
    detail: 'Uma cópia dos dados atuais será salva na pasta de backups antes da importação.',
  });
  if (response !== 1) return false;
  try {
    storage.importar(filePaths[0]);
  } catch (e) {
    dialog.showErrorBox('Erro ao importar', e.message);
    return false;
  }
  janela.webContents.send('dados:recarregar');
  return true;
}

function registrarIpc() {
  const handle = (canal, fn) =>
    ipcMain.handle(canal, async (_e, ...args) => {
      try {
        return { ok: true, valor: await fn(...args) };
      } catch (e) {
        return { ok: false, erro: e.message };
      }
    });

  handle('pacientes:listar', (busca) => storage.listarPacientes(busca));
  handle('pacientes:obter', (id) => storage.obterPaciente(id));
  handle('pacientes:salvar', (dados) => storage.salvarPaciente(dados));
  handle('pacientes:excluir', (id) => storage.excluirPaciente(id));
  handle('atendimentos:listar', (pacienteId) => storage.listarAtendimentos(pacienteId));
  handle('atendimentos:salvar', (dados) => storage.salvarAtendimento(dados));
  handle('atendimentos:excluir', (id) => storage.excluirAtendimento(id));
  handle('sistema:info', () => ({
    versao: app.getVersion(),
    pastaDados: app.getPath('userData'),
    plataforma: process.platform,
    iniciarComSistema: app.getLoginItemSettings().openAtLogin,
  }));
  handle('sistema:inicio-automatico', (ativo) => {
    const valor = definirInicioAutomatico(!!ativo);
    criarMenu();
    return valor;
  });
  handle('sistema:abrir-pasta', () => shell.openPath(app.getPath('userData')));
  handle('sistema:exportar', exportarBackup);
  handle('sistema:importar', importarBackup);
  handle('sistema:imprimir', () => janela.webContents.print({ printBackground: true }));
}

app.on('before-quit', () => {
  saindo = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
