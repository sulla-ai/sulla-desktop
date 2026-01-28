import Electron, { Menu, MenuItem, MenuItemConstructorOptions, shell } from 'electron';

import { getVersion, parseDocsVersion } from '@pkg/utils/version';
import { openDockerDashboard, openMain } from '@pkg/window';
import { openDashboard } from '@pkg/window/dashboard';
import { openPreferences } from '@pkg/window/preferences';

const baseUrl = `https://docs.rancherdesktop.io`;

async function versionedDocsUrl() {
  const version = await getVersion();
  const parsed = parseDocsVersion(version);

  return `${ baseUrl }/${ parsed }`;
}

export default function buildApplicationMenu(): void {
  const menuItems: MenuItem[] = getApplicationMenu();
  const menu = Menu.buildFromTemplate(menuItems);

  Menu.setApplicationMenu(menu);
}

function getApplicationMenu(): MenuItem[] {
  switch (process.platform) {
  case 'darwin':
    return getMacApplicationMenu();
  case 'linux':
    return getWindowsApplicationMenu();
  case 'win32':
    return getWindowsApplicationMenu();
  default:
    throw new Error(`Unsupported platform: ${ process.platform }`);
  }
}

function getNeuralNetworkMenu(): MenuItem {
  return new MenuItem({
    label:   'Neural Network',
    submenu: [
      {
        label: 'Docker',
        click: openDockerDashboard,
      },
      {
        label: 'Preferences…',
        click: openPreferences,
      },
      { type: 'separator' },
      {
        id:      'k8s-state',
        label:   'Kubernetes is starting',
        enabled: false,
      },
      {
        id:      'network-status',
        label:   'Network status: checking',
        enabled: false,
      },
      {
        id:      'container-engine',
        label:   'dockerd (moby)',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Cluster Dashboard',
        click: openDashboard,
      },
      {
        id:      'k8s-contexts',
        label:   'Kubernetes Contexts',
        submenu: [],
      },
    ],
  });
}

function getEditMenu(isMac: boolean): MenuItem {
  return new MenuItem({
    label:   '&Edit',
    submenu: [
      { role: 'undo', label: '&Undo' },
      { role: 'redo', label: '&Redo' },
      { type: 'separator' },
      { role: 'cut', label: 'Cu&t' },
      { role: 'copy', label: '&Copy' },
      { role: 'paste', label: '&Paste' },
      { role: 'delete', label: 'De&lete' },
      ...(!isMac ? [{ type: 'separator' } as MenuItemConstructorOptions] : []),
      { role: 'selectAll', label: 'Select &All' },
    ],
  });
}

function getViewMenu(): MenuItem {
  return new MenuItem({
    label:   '&View',
    submenu: [
      ...(Electron.app.isPackaged
        ? []
        : [
          { role: 'reload', label: '&Reload' },
          { role: 'forceReload', label: '&Force Reload' },
          { role: 'toggleDevTools', label: 'Toggle &Developer Tools' },
          { type: 'separator' },
        ] as const),
      {
        label:       '&Actual Size',
        accelerator: 'CmdOrCtrl+0',
        click(_item, focusedWindow) {
          adjustZoomLevel(focusedWindow, 0);
        },
      },
      {
        label:       'Zoom &In',
        accelerator: 'CmdOrCtrl+Plus',
        click(_item, focusedWindow) {
          adjustZoomLevel(focusedWindow, 0.5);
        },
      },
      {
        label:       'Zoom &Out',
        accelerator: 'CmdOrCtrl+-',
        click(_item, focusedWindow) {
          adjustZoomLevel(focusedWindow, -0.5);
        },
      },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Toggle Full &Screen' },
    ],
  });
}

function getHelpMenu(isMac: boolean): MenuItem {
  const helpMenuItems: MenuItemConstructorOptions[] = [
    ...(!isMac
      ? [
        {
          role:  'about',
          label: `&About ${ Electron.app.name }`,
          click() {
            Electron.app.showAboutPanel();
          },
        } as MenuItemConstructorOptions,
        { type: 'separator' } as MenuItemConstructorOptions,
      ]
      : []),
    {
      label: isMac ? 'Sulla Desktop &Help' : 'Get &Help',
      click: async() => {
        shell.openExternal(await versionedDocsUrl());
      },
    },
    {
      label: 'File a &Bug',
      click() {
        shell.openExternal('https://github.com/sulla-ai/desktop/issues');
      },
    },
    {
      label: '&Project Page',
      click() {
        shell.openExternal('https://github.com/sulla-ai/desktop');
      },
    },
    {
      label: '&Discuss',
      click() {
        shell.openExternal('https://github.com/sulla-ai/desktop/discussions');
      },
    },
  ];

  return new MenuItem({
    role:    'help',
    label:   '&Help',
    submenu: helpMenuItems,
  });
}

function getMacApplicationMenu(): MenuItem[] {
  return [
    new MenuItem({
      label:   Electron.app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        ...getPreferencesMenuItem(),
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }),
    new MenuItem({
      label:   'File',
      submenu: [
        {
          label:       'Agent',
          accelerator: 'CmdOrCtrl+Shift+A',
          click:       openMain,
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    }),
    getEditMenu(true),
    getViewMenu(),
    getNeuralNetworkMenu(),
    new MenuItem({
      label: '&Window',
      role:  'windowMenu',
    }),
    getHelpMenu(true),
  ];
}

function getWindowsApplicationMenu(): MenuItem[] {
  return [
    new MenuItem({
      label:   '&File',
      submenu: [
        {
          label:       '&Agent',
          accelerator: 'CmdOrCtrl+Shift+A',
          click:       openMain,
        },
        { type: 'separator' },
        ...getPreferencesMenuItem(),
        {
          role:  'quit',
          label: 'E&xit',
        },
      ],
    }),
    getEditMenu(false),
    getViewMenu(),
    getNeuralNetworkMenu(),
    getHelpMenu(false),
  ];
}

/**
 * Gets the preferences menu item for all supported platforms
 * @returns MenuItemConstructorOptions: The preferences menu item object
 */
function getPreferencesMenuItem(): MenuItemConstructorOptions[] {
  return [
    {
      label:               'Docker…',
      id:                  'docker-dashboard',
      visible:             true,
      registerAccelerator: true,
      accelerator:         'CmdOrCtrl+,',
      click:               openDockerDashboard,
    },
    {
      label:               'Preferences…',
      id:                  'preferences',
      visible:             true,
      registerAccelerator: true,
      accelerator:         'CmdOrCtrl+Shift+,',
      click:               openPreferences,
    },
    { type: 'separator' },
  ];
}

/**
 * Adjusts the zoom level for the focused window by the desired increment.
 * Also emits an IPC request to the webContents to trigger a resize of the
 * extensions view.
 * @param focusedWindow The window that has focus
 * @param zoomLevelAdjustment The desired increment to adjust the zoom level by
 */
function adjustZoomLevel(focusedWindow: Electron.BaseWindow | undefined, zoomLevelAdjustment: number) {
  if (!focusedWindow || !(focusedWindow instanceof Electron.BrowserWindow)) {
    return;
  }

  const { webContents } = focusedWindow;
  const currentZoomLevel = webContents.getZoomLevel();
  const desiredZoomLevel = zoomLevelAdjustment === 0 ? zoomLevelAdjustment : currentZoomLevel + zoomLevelAdjustment;

  webContents.setZoomLevel(desiredZoomLevel);

  // Also sync the zoom level of any child views (e.g. the extensions view in
  // the main window).
  for (const child of focusedWindow.contentView.children) {
    if (child instanceof Electron.WebContentsView) {
      child.webContents.setZoomLevel(desiredZoomLevel);
    }
  }
  // For the main window, this triggers resizing the extensions view.
  setImmediate(() => webContents.send('extensions/getContentArea'));
}
