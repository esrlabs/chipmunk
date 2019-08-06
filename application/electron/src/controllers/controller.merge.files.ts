// tslint:disable:max-classes-per-file
import * as fs from 'fs';
import * as path from 'path';
import ServiceStreams from '../services/service.streams';
import ServiceStreamSource from '../services/service.stream.sources';
import ServiceElectron, { IPCMessages } from '../services/service.electron';
import * as Tools from '../tools/index';
import { Lvin, IIndexResult, IFileToBeMerged, IFileMapItem, ILogMessage } from 'logviewer.lvin';
import Logger from '../tools/env.logger';

export interface IFile {
    file: string;
    year?: number;
    offset: number;
    parser: string;
    format: string;
}

export default class MergeFiles {

    private _logger: Logger = new Logger('MergeFiles');
    private _session: string = '';
    private _files: IFile[];
    private _sourceIds: { [key: string]: number } = {};
    private _writeSessionsId: string = Tools.guid();

    constructor(files: IFile[], session?: string) {
        this._files = files;
        this._session = session === undefined ? ServiceStreams.getActiveStreamId() : session;
    }

    public write(): Promise<number> {
        return new Promise((resolve, reject) => {
            // Remember active session
            const session: string = ServiceStreams.getActiveStreamId();
            // Get common file size
            this._getSize().then((size: number) => {
                const sessionData = ServiceStreams.getStreamFile(this._session);
                if (sessionData instanceof Error) {
                    return reject(sessionData);
                }
                // Start session
                ServiceStreams.addPipeSession(this._writeSessionsId, size, this._files.map((file: IFile) => {
                    return path.basename(file.file);
                }).join('; '));
                // Add new description of source
                this._files.forEach((file: IFile) => {
                    this._sourceIds[file.file] = ServiceStreamSource.add({ name: path.basename(file.file), session: this._session });
                });
                const lvin: Lvin = new Lvin();
                lvin.on(Lvin.Events.map, (map: IFileMapItem[]) => {
                    const converted = map.map((item: IFileMapItem) => {
                        return { bytes: { from: item.b[0], to: item.b[1] }, rows: { from: item.r[0], to: item.r[1] } };
                    });
                    const mapped: number = converted.length === 0 ? 0 : (converted[map.length - 1].bytes.to - converted[0].bytes.from);
                    ServiceStreams.pushToStreamFileMap(this._session, converted);
                    ServiceStreams.updatePipeSession(mapped, this._session);
                });
                const files = this._files.map((file: IFile) => {
                    return {
                        file: file.file,
                        offset: file.offset,
                        sourceId: this._sourceIds[file.file].toString(),
                        year: file.year,
                        format: file.format,
                    } as IFileToBeMerged;
                });
                lvin.merge(files,
                    {
                        destFile: sessionData.file,
                    },
                ).then((results: IIndexResult) => {
                    if (results.logs instanceof Array) {
                        results.logs.forEach((log: ILogMessage) => {
                            ServiceElectron.IPC.send(new IPCMessages.Notification({
                                type: log.severity,
                                row: log.line_nr === null ? undefined : log.line_nr,
                                file: log.file_name,
                                message: log.text,
                                caption: log.file_name === undefined ? 'Mergin Error' : log.file_name,
                                session: session,
                            }));
                        });
                    }
                    lvin.removeAllListeners();
                    ServiceStreams.removePipeSession(this._writeSessionsId);
                    resolve(size);
                }).catch((error: Error) => {
                    lvin.removeAllListeners();
                    ServiceStreams.removePipeSession(this._writeSessionsId);
                    reject(error);
                });
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public destroy() {
        ServiceStreams.removePipeSession(this._writeSessionsId);
        // Drop all others
        this._sourceIds = {};
    }

    private _getSize(): Promise<number> {
        return new Promise((resolve, reject) => {
            let size: number = 0;
            Promise.all(this._files.map((file: IFile) => {
                return new Promise((resolveFile, rejectFile) => {
                    fs.stat(file.file, (error: NodeJS.ErrnoException | null, stats: fs.Stats) => {
                        if (error !== null) {
                            return rejectFile(error);
                        }
                        size += stats.size;
                        resolveFile();
                    });
                });
            })).then(() => {
                resolve(size);
            }).catch((error) => {
                reject(error);
            });
        });
    }

}
