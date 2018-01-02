"use strict";
var APICommands = {
    OPEN_FILE_STREAM: 'openFileStream',
    serialPortsList: 'serialPortsList',
    openSerialPort: 'openSerialPort',
    closeSerialStream: 'closeSerialStream',
    openLogcatStream: 'openLogcatStream',
    setSettingsLogcatStream: 'setSettingsLogcatStream',
    closeLogcatStream: 'closeLogcatStream',
    openProcessStream: 'openProcessStream',
    closeProcessStream: 'closeProcessStream',
    setSettingsOfMonitor: 'setSettingsOfMonitor',
    restartMonitor: 'restartMonitor',
    getFilesDataMonitor: 'getFilesDataMonitor',
    stopAndClearMonitor: 'stopAndClearMonitor',
    getSettingsMonitor: 'getSettingsMonitor',
    getFileContent: 'getFileContent',
    getAllFilesContent: 'getAllFilesContent',
    getMatches: 'getMatches',
    clearLogsOfMonitor: 'clearLogsOfMonitor',
    getStateMonitor: 'getStateMonitor',
    dropSettings: 'dropSettings',
    checkUpdates: 'checkUpdates',
    openDevConsole: 'openDevConsole'
};
exports.APICommands = APICommands;
function isAPICommandValid(command) {
    var result = false;
    Object.keys(APICommands).forEach(function (key) {
        APICommands[key] === command && (result = true);
    });
    return true;
}
exports.isAPICommandValid = isAPICommandValid;
//# sourceMappingURL=api.commands.js.map