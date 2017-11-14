"use strict";
var APICommands = {
    OPEN_FILE_STREAM: 'openFileStream',
    serialPortsList: 'serialPortsList',
    openSerialPort: 'openSerialPort',
    closeSerialStream: 'closeSerialStream'
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