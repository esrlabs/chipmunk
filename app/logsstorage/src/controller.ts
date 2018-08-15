import { Request, Response, Express} from 'express';
import { FileManager } from './filestorage';
import { v4 as getGUID } from 'uuid';
const Path = require('path');
const CONFIG = require('../config');

export default class Controller {

    private fileManager: FileManager = new FileManager();

    constructor(app: Express){
        app.route('/logs')
            .post(this._addLogs.bind(this))
            .get(this._getLogs.bind(this));

        app.route('/greeting')
            .get(this._greeting.bind(this));

        this._checkStorageFolder();
    }

    private _checkStorageFolder(){
        if (this.fileManager.isExistsSync(CONFIG.FILESTORAGE_FOLDER)){
            return;
        }
        this.fileManager.createFolder(CONFIG.FILESTORAGE_FOLDER);
    }

    private _greeting(req: Request, res: Response){
        res.writeHead(200, {'Content-Type': 'text/plain'});
        return res.end('logviewer');
    }

    private _addLogs(req: Request, res: Response){
        const logFileID = `${(new Date()).getTime()}-${getGUID()}.txt`;
        let content = (req as any).rawBodyStr;
        if (typeof content !== 'string' || content.trim() === '') {
            res.writeHead(200, {'Content-Type': 'text/plain'});
            return res.end(this._getError(3, `Cannot save empty file`));
        }
        this.fileManager.write(Path.join(CONFIG.FILESTORAGE_FOLDER, logFileID), content)
            .then(() => {
                res.writeHead(200, {'Content-Type': 'text/plain'});
                return res.end(logFileID.replace(/\.txt$/gi, ''));
            })
            .catch((error: Error) => {
                res.writeHead(200, {'Content-Type': 'text/plain'});
                return res.end(this._getError(200, error.message));
            });
    }

    private _getLogs(req: Request, res: Response){
        const logFileID = req.query.logFileId;
        if (typeof logFileID !== 'string' || logFileID.trim() === '') {
            res.writeHead(200, {'Content-Type': 'text/plain'});
            return res.end(this._getError(1, `Cannot detect logFileId`));
        }
        if (!this.fileManager.isExistsSync(Path.join(CONFIG.FILESTORAGE_FOLDER, `${logFileID}.txt`))) {
            res.writeHead(200, {'Content-Type': 'text/plain'});
            return res.end(this._getError(2, `Cannot find a log file with logFileId = ${logFileID}.`));
        }
        this.fileManager.read(Path.join(CONFIG.FILESTORAGE_FOLDER, `${logFileID}.txt`))
            .then((content: string) => {
                res.writeHead(200, {'Content-Type': 'text/plain'});
                return res.end(content);
            })
            .catch((error: Error) => {
                res.writeHead(200, {'Content-Type': 'text/plain'});
                return res.end(this._getError(100, error.message));
            });
    }

    private _getError(code: number, message: string){
        return JSON.stringify({
            code: code,
            message: message
        })
    }

}