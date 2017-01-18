require('electron-debug')({showDevTools: true})

const fs = require('fs')
const path = require('path')
const app = require('electron').app
const dialog = require('electron').dialog
const Menu = require('electron').Menu
const getStdin = require('get-stdin')
const pkg = require('../package.json')
const createWindow = require('./create-window')
const conf = global.conf = require('./config')
const sharedState = require('../shared/shared-state')
const createMenu = require('../shared/create-menu')

const markdownExtensions = [ 'markdown', 'mdown', 'mkdn', 'md', 'mkd', 'mdwn', 'mdtxt', 'mdtext' ]

if (conf.help) {
  console.log(fs.readFileSync(path.join(__dirname, '..', 'docs', 'usage.txt'), 'utf-8'))
  app.exit(0)
}

if (conf.version) {
  console.log(pkg.version)
  app.exit(0)
}

if (conf.versions) {
  console.log('nk-md:      ', pkg.version)
  console.log('electron: ', process.versions['electron'])
  console.log('node:     ', process.versions['node'])
  console.log('chrome:   ', process.versions['chrome'])
  console.log('v8:       ', process.versions['v8'])
  console.log('openssl:  ', process.versions['openssl'])
  console.log('zlib:     ', process.versions['zlib'])
  app.exit(0)
}

var filePath = conf._[0]
const fromFile = !!filePath || process.stdin.isTTY

if (fromFile && filePath) {
  try {
    var stat = fs.statSync(path.resolve(filePath))

    if (stat.isDirectory()) {
      console.error('Cannot open', filePath + ': is a directory')
      app.exit(1)
    }
  } catch (ex) {
    if (ex.code === 'ENOENT') {
      // use default window since no file was provided
      filePath = null
    } else {
      console.error('Cannot open', filePath + ':', ex.message)
      app.exit(1)
    }
  }
}

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  app.quit()
})

app.on('ready', function () {
  addApplicationMenu()
  if (!fromFile) {
    getStdin()
      .then(function (body) {
        console.log(body)
        if (!body) {
          return createWindow(createWindowOptions(true, null))
        }

        createWindow(createWindowOptions(false, body.toString()))
      })
  } else {
    createWindow(createWindowOptions(true, filePath))
  }
})

function createWindowOptions (fromFile, fileOrContent) {
  var windowOptions = {
    devTools: conf.devtools,
    title: conf.title,
    window: conf.window,
    mainStylesheet: conf.get('styles.main'),
    extraStylesheet: conf.get('styles.extra'),
    highlightTheme: conf.get('highlight.theme'),
    highlightStylesheet: conf.get('highlight.stylesheet')
  }

  if (fromFile) {
    windowOptions.filePath = fileOrContent
  } else {
    windowOptions.contents = fileOrContent
  }

  return windowOptions
}

function openFileDialog (win, openInNewWindow) {
  var dialogOptions = {
    title: 'Select markdown file',
    properties: [ 'openFile' ],
    filters: [
      {
        name: 'Markdown',
        extensions: markdownExtensions
      },
      {
        name: 'Al files',
        extensions: [ '*' ]
      }
    ]
  }

  win && dialog.showOpenDialog(win, dialogOptions, function (filePaths) {
    if (!Array.isArray(filePaths) || !filePaths.length) {
      return
    }

    if (!openInNewWindow) {
      return sharedState.setFilePath(win.id, filePaths[0])
    }

    createWindow(createWindowOptions(true, filePaths[0]))
  })
}

function addApplicationMenu () {
  // menu
  var vmdSubmenu = [
    {
      label: 'Close window',
      accelerator: 'CmdOrCtrl+W',
      role: 'close'
    },
    {
      label: 'Quit',
      accelerator: 'CmdOrCtrl+Q',
      click: function () {
        app.quit()
      }
    }
  ]

  if (process.platform === 'darwin') {
    vmdSubmenu = [
      {
        label: 'About nk-md',
        selector: 'orderFrontStandardAboutPanel:'
      },
      {
        type: 'separator'
      }
    ].concat(vmdSubmenu)
  }

  // Doc: https://github.com/atom/electron/blob/master/docs/api/menu-item.md
  var template = [
    {
      label: 'nk-md',
      submenu: vmdSubmenu
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: function (model, item, win) {
            openFileDialog(win, false)
          }
        },
        {
          label: 'Open in new window',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: function (model, item, win) {
            openFileDialog(win, true)
          }
        },
        {
          label: 'Print',
          accelerator: 'CmdOrCtrl+P',
          click: function (model, item, win) {
            win && win.webContents.send('print')
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          role: 'copy',
          enabled: function (model) {
            return model && !!model.selection
          }
        },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          role: 'selectall'
        }
      ]
    },
    {
      label: 'History',
      submenu: [
        {
          label: 'Back',
          accelerator: 'Alt+Left',
          click: function (model, item, win) {
            win && win.webContents.send('history-back')
          },
          enabled: function (model) {
            return model.history && model.history.canGoBack
          }
        },
        {
          label: 'Forward',
          accelerator: 'Alt+Right',
          click: function (model, item, win) {
            win && win.webContents.send('history-forward')
          },
          enabled: function (model) {
            return model.history && model.history.canGoForward
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Revision Question',
          accelerator: 'CmdOrCtrl+E',
          click: function (model, item, win) {
            win && win.webContents.send('toggle-revision')
          }
        },
        {
          type: 'separator'
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: function (model, item, win) {
            win && win.webContents.send('zoom-in')
          }
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: function (model, item, win) {
            win && win.webContents.send('zoom-out')
          }
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: function (model, item, win) {
            win && win.webContents.send('zoom-reset')
          }
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: (function () {
            if (process.platform === 'darwin') {
              return 'Alt+Command+I'
            } else {
              return 'Ctrl+Shift+I'
            }
          })(),
          click: function (model, item, win) {
            win && win.toggleDevTools()
          }
        }
      ]
    }
  ]

  var menu = createMenu(template, {})

  sharedState.subscribe(function () {
    menu.update(sharedState.getFocusedWindowState() || {})
  })

  Menu.setApplicationMenu(menu.getMenu())
}
