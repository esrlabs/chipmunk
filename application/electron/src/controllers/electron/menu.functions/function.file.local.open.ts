import { dialog, OpenDialogReturnValue } from 'electron';
import ServiceFileOpener from '../../../services/files/service.file.opener';
import ServiceStreams from '../../../services/service.streams';
import ServiceElectron from '../../../services/service.electron';
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
            const win = ServiceElectron.getBrowserWindow();
            if (win === undefined) {
                return;
            }
            const extensions: string[] = [];
            this._parsers.forEach((parser: AFileParser) => {
                extensions.push(...parser.getExtensions());
            });
            dialog.showOpenDialog(win, {
                properties: ['openFile', 'showHiddenFiles'],
                filters: [
                    {
                        name: 'Supported Files',
                        extensions: extensions,
                    },
                ],
            }).then((returnValue: OpenDialogReturnValue) => {
                if (!(returnValue.filePaths instanceof Array) || returnValue.filePaths.length !== 1) {
                    return;
                }
                const filename: string = returnValue.filePaths[0];
                getParserForFile(filename).then((parser: AFileParser | undefined) => {
                    if (parser === undefined) {
                        this._logger.error(`Fail to find a parser for file: ${filename}`);
                        return;
                    }
                    ServiceFileOpener.open(filename, ServiceStreams.getActiveStreamId(), parser).catch((error: Error) => {
                        this._logger.warn(`Fail open file "${filename}" due error: ${error.message}`);
                    });
                }).catch((error: Error) => {
                    this._logger.error(`Error to open file "${filename}" due error: ${error.message}`);
                });
            }).catch((error: Error) => {
                this._logger.error(`Fail open file due error: ${error.message}`);
            });
        };
    }

}
