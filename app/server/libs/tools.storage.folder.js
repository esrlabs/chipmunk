const APP_FOLDER = 'logviewer';

let path = false;

module.exports = function getApplicationStoragePath(){

    if (!path){
        const os = require('os');
        const Path = require('path');
        path = Path.resolve(os.homedir() + '/' + APP_FOLDER);
        const FileManager = require('./tools.filemanager');
        const fileManager = new FileManager(true);
        fileManager.createFolder(path);
    }

    return path;
};