const Path = require('path');

const SORT_CONDITIONS = {
	byName: 'byName',
	byNumbersInName: 'byNumbersInName',
	byCreateDate: 'byCreateDate',
	byModificationDate: 'byModificationDate'
};

class FileManager{

    constructor(noLogs = false){
        this._fs = require('fs');
        this.SORT_CONDITIONS = SORT_CONDITIONS;
        if (noLogs !== true) {
            this._logger = new (require('./tools.logger'))('FileManager', true);
        } else {
            this._logger = null;
        }
    }

    load(path) {
        let result = null;
        if (typeof path === 'string' && path.trim() !== '' && this._fs.existsSync(path)) {
            try {
                result = this._fs.readFileSync(path);
                if (!(result instanceof Buffer)) {
                    this._logger !== null && this._logger.debug(`Error during reading a file "${path}". Expected type of content <Buffer>. Gotten type is <${(typeof result)}>.`);
                    result = null;
                }
            } catch (error) {
                this._logger !== null && this._logger.debug(`Error during reading a file "${path}". Error: ${error.message}.`);
            }
        } else {
            this._logger !== null && this._logger.debug(`file "${path}" is not found.`);
        }
        return result;
    }

    append(str, dest){
        if (typeof str !== 'string') {
            this._logger !== null && this._logger.debug(`file "${dest}" is not found.`);
            return false;
        }
        if (typeof dest !== 'string' || dest.trim() === '' || !this._fs.existsSync(dest)){
            this._logger !== null && this._logger.debug(`file "${dest}" is not found.`);
            return false;
        }
        try {
            this._fs.appendFileSync(dest, str);
        } catch (error) {
            this._logger !== null && this._logger.debug(`Error during writting a file "${dest}". Error: ${error.message}.`);
        }
    }

    isExistsSync(dest){
    	try {
			if (typeof dest === 'string' && dest.trim() !== '') {
				return this._fs.existsSync(dest);
			} else {
				return false;
			}
		} catch (e) {
			return false;
		}
    }

    isFilesExistsSync(files) {
		if (!(files instanceof Array)){
			return new Error(`Expected list of files (an array).`);
		}
		//Check files
		let errors = [];
		files.forEach((file) => {
			if (!this.isExistsSync(file)){
				errors.push(file);
			}
		});
		if (errors.length !== 0) {
			return new Error(`Next file(s) doesn't exist: ${errors.join(', ')}`);
		}
		return true;
	}

    save(str, dest) {
        if (typeof str === 'string' && typeof dest === 'string' && dest.trim() !== '') {
            try {
                this._fs.writeFileSync(dest, str);
                return true;
            } catch (error) {
                this._logger !== null && this._logger.debug(`Error during writting a file "${dest}". Error: ${error.message}.`);
            }
        } else {
            this._logger !== null && this._logger.debug(`file "${dest}" is not found.`);
        }
        return false;
    }

    getFileInfo(file){
    	try {
			if (typeof file === 'string' && file.trim() !== '' && this._fs.existsSync(file)){
				return this._fs.statSync(file);
			}
			return null;
		} catch (e) {
			return null;
		}
	}

    getSize(dest){
        const info = this.getFileInfo(dest);
        return info === null ? -1 : info.size;
    }

    getListOfFile(path){
        let list = [];
        if (this._fs.existsSync(path)) {
            this._fs.readdirSync(path).forEach((file) => {
                if (~file.search(/.logs$/i)) {
                    list.push(file);
                }
            });
        } else {
            this._logger !== null && this._logger.debug(`Wrong path "${path}".`);
        }
        return list;
    }

    deleteFile(path){
        if (this._fs.existsSync(path)) {
            this._fs.unlinkSync(path);
        }
    }

    bufferToJSON(buffer){
        buffer = this.decodeBuffer(buffer);
        if (buffer === null) {
            return null;
        }
        try {
            buffer = JSON.parse(buffer);
        } catch (e) {
            buffer = null;
        }
        return buffer;
    }

    decodeBuffer(buffer){
        if (!(buffer instanceof Buffer)){
            return null;
        }
        return buffer.toString('utf8');
    }

    createFolder(dir){
        let error = null;
        try {
            if (!this._fs.existsSync(dir)){
                this._fs.mkdirSync(dir);
                if (!this._fs.existsSync(dir)){
                    error = new Error(`Cannot create folder ${dir}. Probably it's permissions issue.`);
                }
            }
        } catch (err) {
            error = err;
        }
        return error;
    }

    glueFiles(files, dest, delimiter = false) {
        function next(files, dest, index, delimiter, resolve, reject) {
            if (files.length <= index) {
                return resolve(count);
            }

            const file = files[index];

            index += 1;

            if (this.isExistsSync(file)) {
                try {
                	const info = this.getFileInfo(file);
                	if (!info.isFile()) {
						return next.call(this, files, dest, index, delimiter, resolve, reject);
					}
                    const writer = this._fs.createWriteStream(dest, { 'flags': 'a' });
                    const reader = this._fs.createReadStream(file);
                    writer.on('finish', () => {
                        writer.removeAllListeners('finish');
                        if (typeof delimiter === 'string') {
                            this.append(delimiter, dest);
                        }
						count += 1;
                        next.call(this, files, dest, index, delimiter, resolve, reject);
                    });
                    reader.pipe(writer);
                } catch (error) {
                    reject(error);
                }
            } else {
                next.call(this, files, dest, index, delimiter, resolve, reject);
            }
        }
        let count = 0;
        return new Promise((resolve, reject) => {
        	const path = Path.dirname(dest);
            if (!(files instanceof Array) || files.length === 0){
                return reject(new Error(`No files to glue together.`));
            }
            if (typeof dest !== 'string' || dest.trim() === '') {
                return reject(new Error(`Destination file isn't defined.`));
            }
            if (!this.isExistsSync(path)){
                this.createFolder(path);
            }
            if (!this.isExistsSync(dest)) {
                if (!this.save('', dest)){
                    return reject(new Error(`Cannot create destination file`));
                }
            }
            next.call(this, files, dest, 0, delimiter, resolve, reject);
        });
    }

    sort(files, condition){
    	if (!(files instanceof Array)) {
    		return new Error('No files list provided.');
		}
		if (SORT_CONDITIONS[condition] === void 0) {
			return new Error(`Unknown sort conditions: ${condition}. Supported: ${Object.keys(SORT_CONDITIONS).join(', ')}.`)
		}
		let results = files.slice();
		switch (condition){
			case SORT_CONDITIONS.byName:
				results.sort((a, b) => {
					const nameA = Path.basename(a).toUpperCase();
					const nameB = Path.basename(b).toUpperCase();
					if (nameA < nameB) {
						return -1;
					}
					if (nameA > nameB) {
						return 1;
					}
					return 0;
				});
				return results;
			case SORT_CONDITIONS.byNumbersInName:
				results.sort((a, b) => {
					let nameA = parseInt(Path.basename(a).replace(/[^\d]/gi, ''));
					let nameB = parseInt(Path.basename(b).replace(/[^\d]/gi, ''));
					nameA = isNaN(nameA) ? -1 : nameA;
					nameB = isNaN(nameB) ? -1 : nameB;
					if (nameA < nameB) {
						return -1;
					}
					if (nameA > nameB) {
						return 1;
					}
					return 0;
				});
				return results;
			case SORT_CONDITIONS.byCreateDate:
				results.sort((a, b) => {
					let infoA = this.getFileInfo(a);
					let infoB = this.getFileInfo(b);
					infoA = infoA !== null ? parseFloat(infoA.birthtimeMs) : 0;
					infoB = infoB !== null ? parseFloat(infoB.birthtimeMs) : 0;
					if (infoA < infoB) {
						return 1;
					}
					if (infoA > infoB) {
						return -1;
					}
					return 0;
				});
				return results;
			case SORT_CONDITIONS.byModificationDate:
				results.sort((a, b) => {
					let infoA = this.getFileInfo(a);
					let infoB = this.getFileInfo(b);
					infoA = infoA !== null ? parseFloat(infoA.mtimeMs) : 0;
					infoB = infoB !== null ? parseFloat(infoB.mtimeMs) : 0;
					if (infoA < infoB) {
						return 1;
					}
					if (infoA > infoB) {
						return -1;
					}
					return 0;
				});
				return results;
		}
	}


}

module.exports = FileManager;
