const logger        = new (require('./tools.logger'))('ServiceDownloadManager');
const Events        = require('events');
const Path          = require('path');
const util          = require('util');
const FS            = require('fs');
const FileManager   = require('./tools.filemanager');
const PathsSettings = require('./tools.settings.paths');
const pathSettings  = new PathsSettings();

class ServiceDownloadManager{

    constructor(){
        this.fileManager = new FileManager();
    }

    sendFile(file, response){
        if (typeof file !== 'string') {
            return new Error(logger.error(`File has wrong format: ${util.inspect(file)}.`));
        }
        if ((file.trim()).indexOf('..') !== -1 || (file.trim()).indexOf('~') !== -1){
            return new Error(logger.error(`File has unacceptable symbols: ${file}.`));
        }

        file = Path.join(pathSettings.DOWNLOADS, file);

        if (!this.fileManager.isExistsSync(file)) {
            return new Error(logger.error(`No file found: ${file}.`));
        }

        const size = this.fileManager.getSize(file);

        if (size > 2 * 1024 * 1024 * 1024) {
            return new Error(logger.error(`Cannot send file: ${file}, because size more than 2G.`));
        }
        response.setHeader('content-type', 'text/plain');
        response.setHeader('logviewer-file', 'true');
        response.setHeader('content-disposition', 'attachment');
        response.setHeader('access-control-expose-headers', 'logviewer-file, content-disposition, content-type');



        response.writeHead(200);

        let readStream = FS.createReadStream(file);
        readStream.on('close', () => {
            this.fileManager.deleteFile(file);
        });
        readStream.pipe(response);
        return true;
    }
}

module.exports = ServiceDownloadManager;
