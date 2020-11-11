import { dialog, OpenDialogReturnValue } from 'electron';
import ServiceElectron, { IPCMessages } from '../../../services/service.electron';

import Logger from '../../../tools/env.logger';

export default class FunctionOpenLocalFile {

    private _logger: Logger;

    constructor() {
        this._logger = new Logger(`FunctionOpenLocalFile`);
    }

    public getLabel(): string {
        return `Open File`;
    }

    public getHandler(): () => void {
        return () => {
            /*
            ServiceFileOpener.selectAndOpenFile().catch((error: Error) => {
                this._logger.error(`Fail to open file due error: ${error.message}`);
            });
            */
        };
    }

}
