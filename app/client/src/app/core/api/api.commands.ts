const APICommands = {
    OPEN_FILE_STREAM        : 'openFileStream',
    serialPortsList         : 'serialPortsList',
    openSerialPort          : 'openSerialPort',
    closeSerialStream       : 'closeSerialStream',
    openLogcatStream        : 'openLogcatStream',
    setSettingsLogcatStream : 'setSettingsLogcatStream',
    closeLogcatStream       : 'closeLogcatStream',
    tryLogcatStream         : 'tryLogcatStream',
    openProcessStream       : 'openProcessStream',
    closeProcessStream      : 'closeProcessStream',
    setSettingsOfMonitor    : 'setSettingsOfMonitor',
    restartMonitor          : 'restartMonitor',
    getFilesDataMonitor     : 'getFilesDataMonitor',
    stopAndClearMonitor     : 'stopAndClearMonitor',
    getSettingsMonitor      : 'getSettingsMonitor',
    getFileContent          : 'getFileContent',
    getAllFilesContent      : 'getAllFilesContent',
    getMatches              : 'getMatches',
    clearLogsOfMonitor      : 'clearLogsOfMonitor',
    getStateMonitor         : 'getStateMonitor',
    dropSettings            : 'dropSettings',
    checkUpdates            : 'checkUpdates',
    openDevConsole          : 'openDevConsole',
    requestFile             : 'requestFile'
};

function isAPICommandValid(command: string){
    let result = false;
    Object.keys(APICommands).forEach((key)=>{
        APICommands[key] === command && (result = true);
    });
    return true;
}

export { APICommands, isAPICommandValid };
