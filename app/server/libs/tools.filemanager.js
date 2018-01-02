
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
        if (typeof str === 'string' && str.trim() !== '' && typeof dest === 'string' && dest.trim() !== '' && this._fs.existsSync(dest)) {
            try {
                this._fs.appendFileSync(dest, str);
            } catch (error) {
                this._logger !== null && this._logger.debug(`Error during writting a file "${dest}". Error: ${error.message}.`);
            }
        } else {
            this._logger !== null && this._logger.debug(`file "${dest}" is not found.`);
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
            } catch (error) {
                this._logger !== null && this._logger.debug(`Error during writting a file "${dest}". Error: ${error.message}.`);
            }
        } else {
            this._logger !== null && this._logger.debug(`file "${dest}" is not found.`);
        }
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
}

module.exports = FileManager;
