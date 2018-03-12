const ElectronStorage   = require('electron-json-storage');
const logger            = new (require('../server/libs/tools.logger'))('application.storage');
const pathSettings      = require('../server/libs/tools.settings.paths');

class ApplicationStorage {

    constructor(path = ''){
        this._storageLocaltion  = path === '' ? pathSettings.ROOT : path;
        ElectronStorage.setDataPath(this._storageLocaltion);
        logger.debug(`Setup path for storage to: ${this._storageLocaltion}`);
    }

    get(key){
        return new Promise((resolve, reject) => {
            if (typeof key !== 'string'){
                return reject(
                    new Error(logger.error(`Cannot get data, because [key] has incorrect type (expected <string>): ${(typeof key)}`))
                );
            }
            try {
                ElectronStorage.get(key, (error, data) => {
                    let result = data;
                    if (error){
                        logger.error(error);
                        return reject(error);
                    }
                    if (typeof data === 'string') {
                        result = this._getJSON(data);
                    } else {
                        result = data;
                    }
                    resolve(result);
                });
            } catch(error){
                logger.error(error);
                reject(error);
            }
        });
    }

    set(key, json){
        return new Promise((resolve, reject) => {
            if (typeof key !== 'string'){
                return reject(
                    new Error(logger.error(`Cannot get data, because [key] has incorrect type (expected <string>): ${(typeof key)}`))
                );
            }
            if (typeof json !== 'object' || typeof json === 'function'){
                return reject(
                    new Error(logger.error(`Cannot set data, because [json] has incorrect type (expected <object || array || null>): ${(typeof json)}`))
                );
            }
            try {
                ElectronStorage.set(key, json, (error) => {
                    if (error){
                        logger.error(error);
                        return reject(error);
                    }
                    resolve();
                });
            } catch (error) {
                logger.error(error);
                reject(error);
            }
        });
    }

    _getJSON(str){
        let result = str;
        try {
            result = JSON.parse(str);
        } catch (e) {
            result = str;
        }
        return result;
    }
}

module.exports = ApplicationStorage;
