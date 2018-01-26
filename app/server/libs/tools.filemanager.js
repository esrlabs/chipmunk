const PathsSettings = require('./tools.settings.paths');
const pathSettings  = new PathsSettings();

class FileManager{

    constructor(noLogs = false){
        this._fs        = require('fs');
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
        if (typeof dest === 'string' && dest.trim() !== '') {
            return this._fs.existsSync(dest);
        } else {
            return false;
        }
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

    getSize(dest){
        if (typeof dest === 'string' && dest.trim() !== '' && this._fs.existsSync(dest)){
            let stats = this._fs.statSync(dest);
            return stats.size;
        }
        return -1;
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
                return resolve();
            }

            const file = files[index];

            index += 1;

            if (this.isExistsSync(file)) {
                try {
                    const writer = this._fs.createWriteStream(dest, { 'flags': 'a' });
                    const reader = this._fs.createReadStream(file);
                    writer.on('finish', () => {
                        writer.removeAllListeners('finish');
                        if (typeof delimiter === 'string') {
                            this.append(delimiter, dest);
                        }
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

        return new Promise((resolve, reject) => {
            if (!(files instanceof Array) || files.length === 0){
                return reject(new Error(`No files to glue together.`));
            }
            if (typeof dest !== 'string' || dest.trim() === '') {
                return reject(new Error(`Destination file isn't defined.`));
            }
            if (!this.isExistsSync(pathSettings.DOWNLOADS)){
                this.createFolder(pathSettings.DOWNLOADS);
            }
            if (!this.isExistsSync(dest)) {
                if (!this.save('', dest)){
                    return reject(new Error(`Cannot create destination file`));
                }
            }
            next.call(this, files, dest, 0, delimiter, resolve, reject);
        });
    }
}

module.exports = FileManager;
