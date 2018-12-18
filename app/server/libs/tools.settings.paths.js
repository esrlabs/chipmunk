const Path = require('path');

class PathsSettings {

    constructor(){
        this.os                             = require('os');
        this.ROOT                           = Path.resolve(this.os.homedir() + '/logviewer');
        this.SETTINGS_FILE                  = '';
        this.LOGS_ROOT                      = '';
        this.LOGS_FOLDER                    = '';
        this.REGISTER_FILE                  = '';
        this.DOWNLOADS                      = '';
        this.LOGVIEWER_LOGS                 = '';
        this.RELEASES                       = '';
        this.generate();
        this.initialize();
    }

    initialize(){
        const FileManager = require('./tools.filemanager');
        const fileManager = new FileManager(true);
        [this.ROOT, this.LOGS_ROOT, this.LOGS_FOLDER, this.DOWNLOADS, this.RELEASES].forEach((folder) => {
            fileManager.createFolder(folder);
        });
    }

    generate(){
        this.LOGVIEWER_LOGS                 = Path.resolve(this.ROOT + '/logviewer.log');
        this.SETTINGS_FILE                  = Path.resolve(this.ROOT + '/logs/settings.json');
        this.LOGS_ROOT                      = Path.resolve(this.ROOT + '/logs/');
        this.LOGS_FOLDER                    = Path.resolve(this.ROOT + '/logs/files/');
        this.REGISTER_FILE                  = Path.resolve(this.ROOT + '/logs/register.json');
        this.DOWNLOADS                      = Path.resolve(this.ROOT + '/downloads/');
        this.RELEASES                       = Path.resolve(this.ROOT + '/releases/');
    }
}

module.exports = (new PathsSettings());
