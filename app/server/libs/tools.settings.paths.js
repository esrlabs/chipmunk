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
        this.generate();
    }

    generate(){
        this.SETTINGS_FILE                  = Path.resolve(this.ROOT + '/logs/settings.json');
        this.LOGS_ROOT                      = Path.resolve(this.ROOT + '/logs/');
        this.LOGS_FOLDER                    = Path.resolve(this.ROOT + '/logs/files/');
        this.REGISTER_FILE                  = Path.resolve(this.ROOT + '/logs/register.json');
        this.DOWNLOADS                      = Path.resolve(this.ROOT + '/downloads/');
    }
}

module.exports = PathsSettings;
