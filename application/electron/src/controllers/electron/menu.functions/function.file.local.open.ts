import { dialog, OpenDialogReturnValue } from 'electron';
import ServiceFileOpener from '../../../services/files/service.file.opener';
import ServiceStreams from '../../../services/service.streams';
import ServiceElectron from '../../../services/service.electron';
import { AFileParser } from '../../files.parsers/interface';
import Logger from '../../../tools/env.logger';

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
            const win = ServiceElectron.getBrowserWindow();
            if (win === undefined) {
                return;
            }
            dialog.showOpenDialog(win, {
                properties: ['openFile', 'showHiddenFiles'],
                filters: this._parser.getExtnameFilters(),
            }).then((returnValue: OpenDialogReturnValue) => {
                if (!(returnValue.filePaths instanceof Array) || returnValue.filePaths.length !== 1) {
                    return;
                }
                const file: string = returnValue.filePaths[0];
                ServiceFileOpener.open(file, ServiceStreams.getActiveStreamId(), this._parser).catch((error: Error) => {
                    this._logger.warn(`Fail open file due error: ${error.message}`);
                });
            }).catch((error: Error) => {
                this._logger.error(`Fail open file due error: ${error.message}`);
            });
        };
    }

    public hasDirectReadWrite(): boolean {
        return this._parser.parseAndIndex !== undefined;
    }

}
