const logger            = new (require('../server/libs/tools.logger'))('application.storage');
const Path 				= require('path');
const OS 				= require('os');
const FS 				= require('fs');

class ApplicationStorage {

    constructor(){
    	this._path = Path.resolve(OS.homedir() + '/logviewer');
    	this._file = Path.resolve(this._path, 'electron.state.json');
        logger.debug(`Setup path for storage to: ${this._path}`);
    }

    _checkStorageFolder(){
    	if (this._isExistsSync(this._path)){
    		return;
		}
		this._createFolder(this._path);
	}

	_isExistsSync(path){
		try {
			if (typeof path === 'string' && path.trim() !== '') {
				return FS.existsSync(path);
			} else {
				return false;
			}
		} catch (e) {
			return false;
		}
	}

	_delete(path){
    	try {
			if (FS.existsSync(path)) {
				FS.unlinkSync(path);
				return true;
			}
		} catch (e) {
		}
		return false;
	}

	_decode(data){
    	if (typeof data === 'string') {
    		return data;
		}
		if (!(data instanceof Buffer)){
			return '';
		}
		return data.toString('utf8');
	}

	_read() {
		return new Promise((resolve, reject) => {
			FS.readFile(this._file, 'utf8', (err, data) => {
				if (err) {
					logger.debug(`Fail to read file due: ${err.message}`);
					return reject(err);
				}
				resolve(this._decode(data));
			});
		});
	}

	_write(data) {
		return new Promise((resolve, reject) => {
			FS.writeFile(this._file, data, 'utf8', (err) => {
				if (err) {
					return reject(err);
				}
				resolve();
			});
		});
	}

	_createFolder(dir){
		try {
			if (!FS.existsSync(dir)){
				FS.mkdirSync(dir);
				if (!FS.existsSync(dir)){
					return new Error(`Cannot create folder ${dir}. Probably it's permissions issue.`);
				}
			}
		} catch (err) {
			return err;
		}
		return null;
	}

    get(){
        return new Promise((resolve, reject) => {
        	if (!this._isExistsSync(this._file)) {
        		return reject(new Error(`File ${this._file} doesn't exist.`));
			}
            this._read()
				.then((data) => {
					try {
						data = JSON.parse(data);
					} catch (e) {
						logger.debug(`Fail to read data.`);
						return reject(e);
					}
					if (typeof data !== 'object' || data === null){
						return reject(new Error(`Incorrect format of data`));
					}
 					resolve(data);
				})
				.catch((e) => {
					logger.debug(`Fail to read data due error: ${e.message}.`);
					reject(e);
				})
        });
    }

    set(json){
        return new Promise((resolve, reject) => {
            this._delete(this._file);
            this._write(JSON.stringify(json))
				.then(() => {
					resolve();
				})
				.catch((e) => {
					logger.debug(`Fail to write data due error: ${e.message}.`);
					reject(e);
				});
        });
    }
}

module.exports = ApplicationStorage;
