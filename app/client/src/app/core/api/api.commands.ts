const APICommands = {
    OPEN_FILE_STREAM        : 'openFileStream',
    serialPortsList         : 'serialPortsList',
    openSerialPort          : 'openSerialPort',
    closeSerialStream       : 'closeSerialStream',
    openLogcatStream        : 'openLogcatStream',
    setSettingsLogcatStream : 'setSettingsLogcatStream',
    closeLogcatStream       : 'closeLogcatStream'
};

function isAPICommandValid(command: string){
    let result = false;
    Object.keys(APICommands).forEach((key)=>{
        APICommands[key] === command && (result = true);
    });
    return true;
}

export { APICommands, isAPICommandValid };
