const logger = new (require('./tools.logger'))('APICommands');

class APICommands{

    openFileStream(income, response, callback){
        callback('some answer', null);
    }

    //Serial port stream
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

    //Telnet
    openTelnetStream(income, response, callback){
        if (typeof income.params.settings === 'object' && income.params.settings !== null){
            let Telnet = require('./service.telnet.js');
            Telnet.open(income.GUID, income.params.settings, (GUID, error)=>{
                if (error === null){
                    callback(GUID, null);
                } else {
                    callback(null, error);
                }
            });
        } else {
            callback(null, new Error(logger.warning('Not defined [settings].')))
        }
    }

    closeTelnetStream(income, response, callback){
        if (typeof income.params.connection === 'string'){
            let Telnet = require('./service.telnet.js');
            Telnet.close(income.GUID, income.params.connection, (error)=>{
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

    //Logcat stream
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

    tryLogcatStream(income, response, callback){
        let ADBStream = require('./service.adb');
        ADBStream.try(income.GUID, income.params.settings, (streamGUID, error) => {
            if (error === null){
                callback(streamGUID, null);
            } else {
                callback(null, error);
            }
        });
    }

    getADBDevicesList(income, response, callback){
        let ADBStream = require('./service.adb');
        ADBStream.getDevicesList(income.GUID, income.params.settings, (devices, error) => {
            if (error === null){
                callback(devices, null);
            } else {
                callback(null, error);
            }
        });
    }

    //Process stream
    openProcessStream(income, response, callback){
        let Stream = require('./service.process');
        Stream.open(income.GUID, income.params, (streamGUID, error) => {
            if (error === null){
                callback(streamGUID, null);
            } else {
                callback(null, error);
            }
        });
    }

    closeProcessStream(income, response, callback){
        let Stream = require('./service.process');
        Stream.close(income.GUID);
        callback(true, null);
    }

    //Monitor
    setSettingsOfMonitor(income, response, callback){
        let monitor = require('./service.monitor');
        if (typeof income.params !== 'object' || income.params === null || typeof income.params.settings !== 'object' || income.params.settings === null) {
            callback(null, new Error(logger.warning(`Cannot do "setSettingsOfMonitor" because settings isn't defined.`)));
        } else {
            let result = monitor.setSettings(income.params.settings);
            callback(
                !(result instanceof Error) ? true : null,
                result instanceof Error ? result : null
            );
        }
    }

    restartMonitor(income, response, callback){
        let monitor = require('./service.monitor');
        let result = monitor.restart();
        callback(
            !(result instanceof Error) ? true : null,
            result instanceof Error ? result : null
        );
    }

    getFilesDataMonitor(income, response, callback){
        let monitor = require('./service.monitor');
        let result = monitor.getFilesData();
        callback(
            !(result instanceof Error) ? result : null,
            result instanceof Error ? result : null
        );
    }

    stopAndClearMonitor(income, response, callback){
        let monitor = require('./service.monitor');
        let result = monitor.stopAndClear();
        callback(
            !(result instanceof Error) ? true : null,
            result instanceof Error ? result : null
        );
    }

    clearLogsOfMonitor(income, response, callback){
        let monitor = require('./service.monitor');
        let result = monitor.clearLogs();
        callback(
            !(result instanceof Error) ? true : null,
            result instanceof Error ? result : null
        );
    }

    getSettingsMonitor(income, response, callback){
        let monitor = require('./service.monitor');
        let result = monitor.getSettings();
        callback(
            !(result instanceof Error) ? result : null,
            result instanceof Error ? result : null
        );
    }

    getStateMonitor(income, response, callback){
        let monitor = require('./service.monitor');
        let result = monitor.getState();
        callback(
            !(result instanceof Error) ? result : null,
            result instanceof Error ? result : null
        );
    }

    getFileContent(income, response, callback){
        let monitor = require('./service.monitor');
        if (typeof income.params !== 'object' || income.params === null || typeof income.params.file !== 'string') {
            callback(null, new Error(logger.warning(`Cannot do "getFileContent" because file isn't defined.`)));
        } else {
            let content = monitor.getFileContent(income.params.file);
            callback(
                !(content instanceof Error) ? { text: content } : null,
                content instanceof Error ? content : null
            );
        }
    }

    getAllFilesContent(income, response, callback){
        let monitor = require('./service.monitor');
        let content = monitor.getAllFilesContent((file, error) => {
            callback(
                error === null ? { file: file } : null,
                error !== null ? error : null
            );
        });
    }

    getMatches(income, response, callback){
        let monitor = require('./service.monitor');
        if (typeof income.params !== 'object' || income.params === null || typeof income.params.reg !== 'boolean' || !(income.params.search instanceof Array) || income.params.search.length === 0) {
            callback(null, new Error(logger.warning(`Cannot do "getMatches" because reg {boolean} isn't defined or search {Array<string>}.`)));
        } else {
            let result = monitor.getMatches(income.params.reg, income.params.search);
            callback(
                !(result instanceof Error) ? { result: result } : null,
                result instanceof Error ? result : null
            );
        }
    }

    dropSettings(income, response, callback){
        let monitor = require('./service.monitor');
        let result = monitor.dropSettings();
        callback(
            !(result instanceof Error) ? result : null,
            result instanceof Error ? result : null
        );
    }

    //Electron
    checkUpdates(income, response, callback){
        let updater = null;
        try{
            updater = require('../../electron').updater;
        }catch (error){
            updater = null;
        }
        if (updater === null || updater === void 0) {
            return callback(null, new Error('Updater is available only for desktop versions.'))
        }
        updater.check().then((result) => {
            if (result !== null && typeof result === 'object' && result.updateInfo !== void 0) {
                callback({
                    res: result,
                    cancellationToken: result.cancellationToken,
                    cancellationTokenType: typeof result.cancellationToken
                }, null);
            } else {
                callback(null, new Error(`Unexpected result of updating checks`));
            }
        }).catch((error)=>{
            callback(null, error);
        });
    }

    openDevConsole(income, response, callback){
        let starter = null;
        try{
            starter = require('../../electron').starter;
        }catch (error){
            starter = null;
        }
        if (starter === null || starter === void 0) {
            return callback(null, new Error('Electron is available only for desktop versions.'))
        }
        starter.debug();
        callback(true, null);
    }

    requestFile(income, response, callback){

        if (typeof income.params !== 'object' || income.params === null || typeof income.params.file !== 'string' || income.params.file.trim() === '') {
            return callback(null, new Error(logger.warning(`Cannot do "requestFile" because file {string} isn't defined.`)));
        }

        const ServiceDownloadManager    = require('./service.downloadmanager');
        const serviceDownloadManager    = new ServiceDownloadManager();

        const error = serviceDownloadManager.sendFile(income.params.file, response);

        if (error instanceof Error) {
            return callback(null, error);
        }

        //Do not callback, because ServiceDownloadManager will response by itself
    }

};

module.exports = APICommands;
