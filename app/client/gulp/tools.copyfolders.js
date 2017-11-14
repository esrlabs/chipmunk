/**
 * Created by dmitry.astafyev on 06.04.17.
 */
class CopyFoldersTasks {
    constructor({ src = null, dest = null, exclude = [], silince = true } = {}){
        if (src !== null && dest !== null){
            this.src        = this.normalizePath(src);
            this.dest       = this.normalizePath(dest);
            this.exclude    = exclude;
            this.silince    = silince;
        } else {
            throw new Error('[gulpfile.copyfolder.js][error]:: [src] & [dest] should be defined as strings.');
        }
    }
    normalizePath(path){
        return ~path.search(/\/$/gi) ? path : (path + '/');
    }
    isFolder(path){
        let FS      = require('fs'),
            stat    = FS.lstatSync(path);
        return stat.isDirectory();
    }
    checkFolder(dest){
        let FS = require('fs');
        if (!FS.existsSync(dest)){
            FS.mkdirSync(dest);
            !this.silince && console.log('[CopyFolder][create folder]:: ' + dest);
        }
    }
    clearFolder(dest){
        let FS      = require('fs'),
            files   = FS.readdirSync(dest);
        !this.silince && console.log('[CopyFolder][clear][start]:: ' + dest);
        files.forEach((file)=>{
            if (!this.isFolder(dest + file)){
                FS.unlinkSync(dest + file);
                !this.silince && console.log('[CopyFolder][clear][file]:: ' + file);
            }
        });
        !this.silince && console.log('[CopyFolder][finish]:: ' + dest);
    }
    copyFile(src, dest){
        let FS = require('fs');
        FS.createReadStream(src).pipe(FS.createWriteStream(dest));
        !this.silince && console.log('[CopyFolder][copy][file]:: ' + src + ' => ' + dest);
    }
    folder(src, dest, exclude){
        let FS      = require('fs'),
            files   = FS.readdirSync(src),
            tasks   = [];
        this.checkFolder(dest);
        this.clearFolder(dest);
        files.forEach((file)=>{
            let isFolder = this.isFolder(src + file);
            if (isFolder && !~exclude.indexOf(src + file)){
                this.checkFolder(this.normalizePath(dest + file));
                this.clearFolder(this.normalizePath(dest + file));
                this.folder(this.normalizePath(src + file),this.normalizePath(dest + file), exclude);
            } else if(!isFolder) {
                this.copyFile(src + file, dest + file);
            }
        });
        return tasks;
    }
    copy(){
        return this.folder(this.src, this.dest, this.exclude);
    }
}

module.exports = CopyFoldersTasks;