const FS = require('fs');

export class FileManager{

    read(path: string): Promise<string> {
        return new Promise((resolve, reject) => {
            FS.readFile(path, 'utf8', (err: Error, data: Buffer) => {
                if (err) {
                    return reject(err);
                }
                resolve(this.decode(data))
            });
        });
    }

    write(path: string, data: string): Promise<void> {
        return new Promise((resolve, reject) => {
            FS.writeFile(path, data, 'utf8', (err: Error) => {
                if (err) {
                    return reject(err);
                }
                resolve()
            });
        });
    }

    isExistsSync(path: string){
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

    delete(path: string){
        if (FS.existsSync(path)) {
            try {
                return FS.unlinkSync(path);
            } catch (e) {
                return false;
            }
        }
    }

    decode(smth: Buffer | string){
        if (typeof smth === 'string') {
            return smth;
        }
        if (smth instanceof Buffer){
            return smth.toString('utf8');
        }
        return '';
    }

    list(path: string): Promise<Array<string>> {
        return new Promise((resolve, reject) => {
            if (!FS.existsSync(path)) {
                return reject(new Error(`Target folder doesn't exist`));
            }
            FS.readdir(path, (error: Error, list: Array<string>) => {
                if (error){
                    return reject(error);
                }
                resolve(list);
            });
        });
    }

    getInfo(file: string) {
        if (typeof file !== 'string' || file.trim() === '' || !FS.existsSync(file)){
            return null;
        }
        try {
            return FS.statSync(file);
        } catch (e) {
            return null;
        }
    }

    createFolder(dir: string){
        let error = null;
        try {
            if (!FS.existsSync(dir)){
                FS.mkdirSync(dir);
                if (!FS.existsSync(dir)){
                    error = new Error(`Cannot create folder ${dir}. Probably it's permissions issue.`);
                }
            }
        } catch (err) {
            error = err;
        }
        return error;
    }

}