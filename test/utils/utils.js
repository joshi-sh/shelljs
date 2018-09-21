const child = require('child_process');
const path = require('path');
const fs = require('fs');

const chalk = require('chalk');

const common = require('../../src/common');

// Capture process.stderr.write, otherwise we have a conflict with mocks.js
const _processStderrWrite = process.stderr.write.bind(process.stderr);

function numLines(str) {
  return typeof str === 'string' ? (str.match(/\n/g) || []).length + 1 : 0;
}
exports.numLines = numLines;

function getTempDir() {
  // a very random directory
  return ('tmp' + Math.random() + Math.random()).replace(/\./g, '');
}
exports.getTempDir = getTempDir;

function isWindowsOrWSL() {
  // Test for windows
  if (process.platform === 'win32') {
    return true;
  }
  return ['/proc/sys/kernel/osrelease', '/proc/version'].some(file => {
    if (fs.existsSync(file)) {
      return fs.readFileSync(file, { encoding: 'ascii' }).search(/WSL|Microsoft/i) > -1;
    }
    return false;
  });
}

// On Windows, symlinks for files need admin permissions. This helper
// skips certain tests if we are on Windows and got an EPERM error
function skipOnWinForEPERM(action, testCase) {
  const ret = action();
  const error = ret.code;
  const isWindows = isWindowsOrWSL();
  if (isWindows && error && /EPERM:/.test(error)) {
    _processStderrWrite('Got EPERM when testing symlinks on Windows. Assuming non-admin environment and skipping test.\n');
  } else {
    testCase();
  }
}
exports.skipOnWinForEPERM = skipOnWinForEPERM;

function runScript(script, cb) {
  child.execFile(common.config.execPath, ['-e', script], cb);
}
exports.runScript = runScript;

function sleep(time) {
  const testDirectoryPath = path.dirname(__dirname);
  child.execFileSync(common.config.execPath, [
    path.join(testDirectoryPath, 'resources', 'exec', 'slow.js'),
    time.toString(),
  ]);
}
exports.sleep = sleep;

function mkfifo(dir) {
  if (!isWindowsOrWSL()) {
    const fifo = dir + 'fifo';
    child.execFileSync('mkfifo', [fifo]);
    return fifo;
  }
  return null;
}
exports.mkfifo = mkfifo;

function skipIfTrue(booleanValue, t, closure) {
  if (booleanValue) {
    const w = isWindowsOrWSL();
    _processStderrWrite(
      chalk.yellow('Warning: skipping platform-dependent test. ') +
      chalk.bold.white(`'${t._test.title}' `) +
      chalk.bold.white(`on platform: ${w ? 'Windows' : 'Linux'}`) +
      '\n'
    );
    t.truthy(true); // dummy assertion to satisfy ava v0.19+
  } else {
    closure();
  }
}

exports.skipOnUnix = skipIfTrue.bind(module.exports, !isWindowsOrWSL());
exports.skipOnWin = skipIfTrue.bind(module.exports, isWindowsOrWSL());
