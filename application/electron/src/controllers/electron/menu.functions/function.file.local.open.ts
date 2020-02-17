import { dialog, OpenDialogReturnValue } from 'electron';
import ServiceFileOpener from '../../../services/files/service.file.opener';
import ServiceElectron, { IPCMessages } from '../../../services/service.electron';
import { AFileParser, getParserForFile } from '../../../controllers/files.parsers/index';

import Logger from '../../../tools/env.logger';

export default class FunctionOpenLocalFile {

    private _parsers: AFileParser[];
    private _logger: Logger;

    constructor(parsers: AFileParser[]) {
        this._parsers = parsers;
        this._logger = new Logger(`FunctionOpenLocalFile`);
    }

    public getLabel(): string {
        return `Open File`;
    }

    public getHandler(): () => void {
        return () => {
            ServiceFileOpener.selectAndOpenFile().catch((error: Error) => {
                this._logger.error(`Fail to open file due error: ${error.message}`);
            });
        };
    }

}
