const logger = new (require('./tools.logger'))('APICommands');

class APICommands{

    openFileStream(income, response, callback){
        callback('some answer', null);
    }

    serialPortsList(income, response, callback){
        let Serial = require('./service.serial.js');
        Serial.getListPorts((result)=>{
            callback(result, null);
        });
    }

    openSerialPort(income, response, callback){
        if (typeof income.params.port === 'string' && typeof income.params.settings === 'object' && income.params.settings !== null){
            let Serial = require('./service.serial.js');
            Serial.open(income.GUID, income.params.port, income.params.settings, (GUID, error)=>{
                if (error === null){
                    callback(GUID, null);
                } else {
                    callback(null, error);
                }
            });
        } else {
            callback(null, new Error(logger.warning('Not defined [port] or [settings].')))
        }
    }

    closeSerialStream(income, response, callback){
        if (typeof income.params.connection === 'string'){
            let Serial = require('./service.serial.js');
            Serial.close(income.GUID, income.params.connection, (error)=>{
                if (error === null){
                    callback(true, null);
                } else {
                    callback(null, error);
                }
            });
        } else {
            callback(null, new Error(logger.warning('Not defined [connection].')))
        }
    }

    openLogcatStream(income, response, callback){
        let ADBStream = require('./service.adb');
        ADBStream.open(income.GUID, income.params.settings, (streamGUID, error) => {
            if (error === null){
                callback(streamGUID, null);
            } else {
                callback(null, error);
            }
        });
    }

    setSettingsLogcatStream(income, response, callback){
        let ADBStream = require('./service.adb');
        ADBStream.setSettings(income.GUID, income.params.settings, (result, error) => {
            if (error === null){
                callback(true, null);
            } else {
                callback(null, error);
            }
        });
    }

    closeLogcatStream(income, response, callback){
        let ADBStream = require('./service.adb');
        ADBStream.close(income.GUID);
        callback(true, null);
    }
};

module.exports = APICommands;
