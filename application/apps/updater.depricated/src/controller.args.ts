import * as fs from 'fs';
import { log } from './logger';

export class ControllerArguments {

    private _app: string | undefined;
    private _tgz: string | undefined;

    constructor() {
        this._app = process.argv[2];
        this._tgz = process.argv[3];
        log(`Next arguments are gotten:\n\t- app: ${this._app}\n\t- tgz: ${this._tgz}`);
        if (typeof this._app !== 'string' || this._app.trim() === '' ||
            typeof this._tgz !== 'string' || this._tgz.trim() === '' ) {
            this._app = undefined;
            this._tgz = undefined;
            log(`Arguments are wrong.`);
            return;
        }
        if (!fs.existsSync(this._app) || !fs.existsSync(this._tgz)) {
            this._app = undefined;
            this._tgz = undefined;
            log(`Files given with arguments aren't found.`);
            return;
        }
        log(`Arguments are OK.`);
    }

    public getApp(): string | undefined {
        return this._app;
    }

    public getTgz(): string | undefined {
        return this._tgz;
    }

}
