import { AFileParser, IFileParserFunc, IMapItem } from './interface';
import { Transform } from 'stream';
import * as path from 'path';
import { Lvin, IIndexResult, IFileMapItem, IDLTLogMessage } from 'logviewer.lvin';
import ServiceElectron, { IPCMessages } from '../../services/service.electron';

const ExtNames = ['dlt'];

export default class FileParser extends AFileParser {

    public getName(): string {
        return 'DLT format';
    }

    public getAlias(): string {
        return 'dlt';
    }

    public getExtnameFilters(): Array<{ name: string, extensions: string[] }> {
        return [
            { name: 'DLT Files', extensions: ExtNames },
        ];
    }

    public isSupported(file: string): boolean {
        const extname: string = path.extname(file).toLowerCase().replace('.', '');
        return ExtNames.indexOf(extname) !== -1;
    }

    public getTransform(): Transform | undefined {
        // Do not need any transform operations
        return undefined;
    }

    public getParserFunc(): IFileParserFunc {
        return {
            parse: (chunk: Buffer) => {
                return new Promise((resolve) => {
                    resolve(chunk);
                });
            },
            close: () => {
                // Do nothing
            },
            rest: () => {
                // Do nothing
                return '';
            },
        };
    }

    public readAndWrite(srcFile: string, destFile: string, sourceId: string, options: { [key: string]: any }, onMapUpdated?: (map: IMapItem[]) => void): Promise<IMapItem[]> {
        return new Promise((resolve, reject) => {
            const lvin: Lvin = new Lvin();
            if (onMapUpdated !== undefined) {
                lvin.on(Lvin.Events.map, (map: IFileMapItem[]) => {
                    onMapUpdated(map.map((item: IFileMapItem) => {
                        return { bytes: { from: item.b[0], to: item.b[1] }, rows: { from: item.r[0], to: item.r[1] } };
                    }));
                });
            }
            const dltOptions: { [key: string]: any } = {
                logLevel: options.logLevel,
            };
            if (options.filters !== undefined && options.filters.app_ids instanceof Array) {
                dltOptions.APID = options.filters.app_ids;
            }
            if (options.filters !== undefined && options.filters.context_ids instanceof Array) {
                dltOptions.CTID = options.filters.context_ids;
            }
            if (options.filters !== undefined && options.filters.ecu_ids instanceof Array) {
                dltOptions.ECUID = options.filters.ecu_ids;
            }
            lvin.dlt({
                srcFile: srcFile,
                destFile: destFile,
                injection: sourceId.toString(),
            }, dltOptions).then((results: IIndexResult) => {
                if (results.logs instanceof Array) {
                    results.logs.forEach((log: IDLTLogMessage) => {
                        ServiceElectron.IPC.send(new IPCMessages.Notification({
                            type: log.severity,
                            message: `${log.line_nr !== null ? `[line: ${log.line_nr}]: ` : ''}${log.text}`,
                            caption: path.basename(srcFile),
                        }));
                    });
                }
                lvin.removeAllListeners();
                resolve(results.map.map((item: IFileMapItem) => {
                    return { rows: { from: item.r[0], to: item.r[1] }, bytes: { from: item.b[0], to: item.b[1] }};
                }));
            }).catch((error: Error) => {
                ServiceElectron.IPC.send(new ServiceElectron.IPCMessages.Notification({
                    caption: `Error with: ${path.basename(srcFile)}`,
                    message: error.message.length > 1500 ? `${error.message.substr(0, 1500)}...` : error.message,
                    type: ServiceElectron.IPCMessages.Notification.Types.error,
                }));
                reject(error);
            });
        });
    }

}
