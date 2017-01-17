const path = require('path')
const fs = require('fs')
const BrowserWindow = require('electron').BrowserWindow
const ipc = require('electron').ipcMain
const chokidar = require('chokidar')
const assign = require('object-assign')
const sharedState = require('../shared/shared-state')
const styles = require('./styles')
const windowStateKeeper = require('electron-window-state')

const defaultOptions = {
  width: 375,
  height: 667,
  x: undefined,
  y: undefined
}

module.exports = function createWindow (options) {
  const preservestate = options.window.preservestate && options.window.preservestate !== 'false'

  if (preservestate) {
    var mainWindowState = windowStateKeeper({
      file: 'nk-md-window-state.json',
      defaultWidth: defaultOptions.width,
      defaultHeight: defaultOptions.height
    })
    options = assign({}, mainWindowState, options)
  } else {
    options = assign({}, defaultOptions, options)
  }

  const fromFile = typeof options.filePath !== 'undefined'
  var watcher

  var preloadPath = path.resolve(__dirname, 'client-api.js')

  var win = new BrowserWindow({
    webPreferences: {
      preload: preloadPath
    },
    icon: path.join(__dirname, 'assets/app-icon/png/512.png'),
    width: options.width,
    height: options.height,
    x: options.x,
    y: options.y
  })

  updateTitle()

  temporarilyInterceptFileProtocol()
  win.loadURL('file://' + path.join(__dirname, '/../renderer/nk-md.html'))
  win.on('close', onClose)
  win.webContents.on('did-finish-load', sendMarkdown)

  win.on('closed', function () {
    win = null
  })

  win.on('focus', function () {
    sharedState.setFocusedWindow(win.id)
  })

  if (win.isFocused()) {
    sharedState.setFocusedWindow(win.id)
  }

  if (preservestate) {
    mainWindowState.manage(win)
  }

  if (options.devTools) {
    win.openDevTools()
  }

  if (fromFile) {
    watcher = chokidar.watch(options.filePath, { usePolling: true })
    watcher.on('change', sendMarkdown)
  }

  ipc.on('open-file', onOpenFile)

  sharedState.subscribe(function () {
    if (!win) {
      return
    }

    var state = sharedState.getWindowState(win.id)

    if (state && state.filePath && state.filePath !== options.filePath) {
      changeFile(state.filePath)
    }
  })

  function onOpenFile (ev, filePath) {
    if (ev.sender === win.webContents) {
      createWindow(assign({}, options, {
        filePath: filePath
      }))
    }
  }

  function onClose () {
    if (watcher) {
      watcher.close()
    }

    ipc.removeListener('open-file', onOpenFile)
  }

  function updateTitle () {
    var prefix =
      options.title ||
      (fromFile && (path.basename(options.filePath)))

    win.setTitle(prefix ? prefix + ' - nk-md' : 'nk-md')

    // (OS X) Set represented filename (icon in title bar)
    if (fromFile && process.platform === 'darwin') {
      win.setRepresentedFilename(path.resolve(options.filePath))
    }
  }

  function changeFile (filePath) {
    if (watcher) {
      watcher.unwatch(options.filePath)
      watcher.add(filePath)
    }

    options.filePath = filePath
    updateTitle()
    sendMarkdown()
  }

  function sendMarkdown () {
    const resolved = fromFile
      ? path.resolve(path.dirname(options.filePath))
      : process.cwd()

    var baseUrl = path.relative(__dirname, resolved)
    if (baseUrl) baseUrl += '/'

    if (win) {
      var contents = fromFile
        ? fs.readFileSync(options.filePath, { encoding: 'utf8' })
        : options.contents

      var topic
      try {
        topic = fromFile
          ? fs.readFileSync(path.join(path.dirname(path.dirname(options.filePath)), 'README.md'), { encoding: 'utf8' })
          : ''
      } catch (err) {}

      win.webContents.send('md', {
        filePath: options.filePath,
        baseUrl: baseUrl,
        contents: contents,
        topic: topic
      })
    }
  }

  function temporarilyInterceptFileProtocol () {
    // very hacky way to dynamically create nk-md.html
    const protocol = require('electron').protocol
    const template = require('lodash.template')
    const indexHtml = template(fs.readFileSync(path.join(__dirname, '..', 'renderer', 'nk-md.html'), { encoding: 'utf-8' }))

    protocol.interceptStringProtocol(
      'file',
      function (req, callback) {
        var mainStyle = options.mainStylesheet
          ? styles.getStylesheet(options.mainStylesheet)
          : styles.getStylesheet(require.resolve('enki-insight-renderer/dist/clientEmbedded.css'))

        var extraStyle = options.extraStylesheet
          ? styles.getStylesheet(options.extraStylesheet)
          : ''

        var data = {
          mainStyle: mainStyle,
          extraStyle: extraStyle
        }
        callback({
          mimeType: 'text/html',
          data: indexHtml(data)
        })

        process.nextTick(function () {
          protocol.uninterceptProtocol('file')
        })
      },
      function (err, scheme) {
        if (err) {
          console.error('failed to register', scheme, 'protocol')
        }
      }
    )
  }

  return {
    win: win,
    changeFile: changeFile
  }
}
