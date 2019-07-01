import { dialog } from 'electron';
import ServiceFileOpener from '../../services/service.file.opener';
import { AFileParser } from '../files.parsers/interface';
import Logger from '../../tools/env.logger';

export default class FunctionOpenLocalFile {

    private _parser: AFileParser;
    private _logger: Logger;

    constructor(parser: AFileParser) {
        this._parser = parser;
        this._logger = new Logger(`Parser "${parser.getName()}"`);
    }

    public getLabel(): string {
        return `Open: ${this._parser.getName()}`;
    }

    public getHandler(): () => void {
        return () => {
            dialog.showOpenDialog({
                properties: ['openFile', 'showHiddenFiles'],
                filters: this._parser.getExtnameFilters(),
            }, (files: string[]) => {
                if (!(files instanceof Array) || files.length !== 1) {
                    return;
                }
                const file: string = files[0];
                ServiceFileOpener.open(file, this._parser).catch((error: Error) => {
                    this._logger.warn(`Fail open file due error: ${error.message}`);
                });
            });
        };
    }

    public hasDirectReadWrite(): boolean {
        return this._parser.readAndWrite !== undefined;
    }

}
