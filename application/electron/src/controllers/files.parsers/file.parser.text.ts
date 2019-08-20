import { AFileParser, IFileParserFunc, IMapItem } from './interface';
import { Transform } from 'stream';
import * as path from 'path';
import { Lvin, IIndexResult, IFileMapItem, ILogMessage } from 'logviewer.lvin';
import ServiceElectron, { IPCMessages } from '../../services/service.electron';
import ServiceStreams from '../../services/service.streams';
import * as ft from 'file-type';
import * as fs from 'fs';

const ExtNames = ['txt', 'log', 'logs', 'json', 'less', 'css', 'sass', 'ts', 'js'];

export default class FileParser extends AFileParser {

    public getName(): string {
        return 'text format';
    }

    public getAlias(): string {
        return 'text';
    }

    public getExtnameFilters(): Array<{ name: string, extensions: string[] }> {
        return [
            { name: 'Text files', extensions: ExtNames },
        ];
    }

    public isSupported(file: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            fs.open(file, 'r', (openError: NodeJS.ErrnoException | null, fd: number) => {
                if (openError) {
                    return reject(openError);
                }
                const buffer: Buffer = Buffer.alloc(ft.minimumBytes);
                fs.read(fd, buffer, 0, ft.minimumBytes, 0, (readError: NodeJS.ErrnoException | null, read: number, buf: Buffer) => {
                    if (readError) {
                        return reject(readError);
                    }
                    const type: ft.FileTypeResult | undefined = ft(buf);
                    if (type === undefined) {
                        const extname: string = path.extname(file).toLowerCase().replace('.', '');
                        resolve(ExtNames.indexOf(extname) !== -1);
                    } else if (type.mime.indexOf('text') !== -1 || type.mime.indexOf('application') !== -1) {
                        resolve(true);
                    }
                    resolve(false);
                });
            });
        });
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
            const session: string = ServiceStreams.getActiveStreamId();
            if (onMapUpdated !== undefined) {
                lvin.on(Lvin.Events.map, (map: IFileMapItem[]) => {
                    onMapUpdated(map.map((item: IFileMapItem) => {
                        return { bytes: { from: item.b[0], to: item.b[1] }, rows: { from: item.r[0], to: item.r[1] } };
                    }));
                });
            }
            lvin.index({
                srcFile: srcFile,
                destFile: destFile,
                injection: sourceId.toString(),
            }).then((results: IIndexResult) => {
                if (results.logs instanceof Array) {
                    results.logs.forEach((log: ILogMessage) => {
                        ServiceElectron.IPC.send(new IPCMessages.Notification({
                            type: log.severity,
                            row: log.line_nr === null ? undefined : log.line_nr,
                            file: log.file_name,
                            message: log.text,
                            caption: path.basename(srcFile),
                            session: session,
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
                    session: session,
                }));
                reject(error);
            });
        });
    }

}
