const Path = require('path');
const CONFIG = require('../config');
import { FileManager } from './filestorage';

const CLEAN_TIMEOUT = 1000 * 60 * 10;//10 min
const TO_BE_KILLED_AGE = 1000 * 60 * 60 * 24 * 3; //3 days

export default class Cleaner {

    private timer: NodeJS.Timer;
    private inWork: boolean = false;
    private fileManager: FileManager = new FileManager();

    constructor() {
        this.proceed = this.proceed.bind(this);
        this.proceed();
    }

    private restart(){
        this.timer = setTimeout(this.proceed, CLEAN_TIMEOUT);
        this.inWork = false;
    }

    public proceed(){
        if (this.inWork) {
            return this.restart();
        }
        this.inWork = true;
        this.fileManager.list(CONFIG.FILESTORAGE_FOLDER)
            .then((list: Array<string>) => {
                const now: number = (new Date()).getTime();
                console.log(list);
                list.forEach((file: string) => {
                    file = Path.resolve(CONFIG.FILESTORAGE_FOLDER, file);
                    const stat: any = this.fileManager.getInfo(file);
                    if (stat === null) {
                        return;
                    }
                    if (!stat.isFile()) {
                        return;
                    }
                    console.log(now - stat.ctimeMs);

                    if ((now - stat.ctimeMs) > TO_BE_KILLED_AGE) {
                        this.fileManager.delete(file);
                    }
                });
                this.restart();
            })
            .catch((e) => {
               this.restart();
            });
    }

    public stop(){
        if (this.timer){
            this.timer.unref();
        }
    }
}