const Signature = 'APICommands';

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
            callback(null, new Error('Not defined [port] or [settings].'))
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
            callback(null, new Error('Not defined [connection].'))
        }
    }
};

module.exports = APICommands;
