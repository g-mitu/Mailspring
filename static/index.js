window.eval = global.eval = function() {
  throw new Error("Sorry, N1 does not support window.eval() for security reasons.");
}

var path = require('path');
var electron = require('electron');
var remote = electron.remote;

function setLoadTime (loadTime) {
  if (global.NylasEnv) {
    global.NylasEnv.loadTime = loadTime
    console.log('Window load time: ' + global.NylasEnv.getWindowLoadTime() + 'ms')
  }
}

function handleSetupError (error) {
  var currentWindow = remote.getCurrentWindow()
  currentWindow.setSize(800, 600)
  currentWindow.center()
  currentWindow.show()
  currentWindow.openDevTools()
  console.error(error.stack || error)
}

function copyEnvFromMainProcess() {
  var _ = require('underscore');
  var remote = require('electron').remote;
  var newEnv = _.extend({}, process.env, remote.process.env);
  process.env = newEnv;
}

function setupWindow (loadSettings) {
  if (process.platform === 'linux') {
    // This will properly inherit process.env from the main process, which it
    // doesn't do by default on Linux. See:
    // https://github.com/atom/electron/issues/3306
    copyEnvFromMainProcess();
  }

  var CompileCache = require('../src/compile-cache')

  // TODO: Re-enable hotreloading when react-proxy is added.
  var hotreload = false
  CompileCache.setHotReload(hotreload)

  CompileCache.setHomeDirectory(loadSettings.configDirPath)

  var ModuleCache = require('../src/module-cache')
  ModuleCache.register(loadSettings)
  ModuleCache.add(loadSettings.resourcePath)

  // Start the crash reporter before anything else.
  // require('crash-reporter').start({
  //   productName: 'N1',
  //   companyName: 'Nylas',
  //   // By explicitly passing the app version here, we could save the call
  //   // of "require('electron').remote.app.getVersion()".
  //   extra: {_version: loadSettings.appVersion}
  // })

  setupVmCompatibility()
  setupCsonCache(CompileCache.getCacheDirectory())

  require(loadSettings.bootstrapScript)
}

function setupCsonCache (cacheDir) {
  require('season').setCacheDir(path.join(cacheDir, 'cson'))
}

function setupVmCompatibility () {
  var vm = require('vm')
  if (!vm.Script.createContext) {
    vm.Script.createContext = vm.createContext
  }
}


window.onload = function() {
  try {
    var startTime = Date.now();

    var fs = require('fs');
    var path = require('path');

    // Skip "?loadSettings=".
    var rawLoadSettings = decodeURIComponent(location.search.substr(14));
    var loadSettings;
    try {
      loadSettings = JSON.parse(rawLoadSettings);
    } catch (error) {
      console.error("Failed to parse load settings: " + rawLoadSettings);
      throw error;
    }

    if (loadSettings.loadingMessage) {
      document.getElementById("application-loading-text-supplement").innerHTML = loadSettings.loadingMessage
    }

    // Normalize to make sure drive letter case is consistent on Windows
    process.resourcesPath = path.normalize(process.resourcesPath);

    setupWindow(loadSettings)
    setLoadTime(Date.now() - startTime)
  }
  catch (error) {
    handleSetupError(error)
  }
}
