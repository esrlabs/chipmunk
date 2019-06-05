// tslint:disable:max-classes-per-file
import * as fs from 'fs';
import * as path from 'path';
import ServiceStreams from '../services/service.streams';
import ServiceStreamSource from '../services/service.stream.sources';
import * as Tools from '../tools/index';
import { Lvin, IIndexResult, IFileToBeMerged, IFileMapItem } from 'logviewer.lvin';
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
                    this._sourceIds[file.file] = ServiceStreamSource.add({ name: path.basename(file.file) });
                });
                const lvin: Lvin = new Lvin();
                lvin.on(Lvin.Events.map, (map: IFileMapItem[]) => {
                    const converted = map.map((item: IFileMapItem) => {
                        return { bytes: { from: item.b[0], to: item.b[1] }, rows: { from: item.r[0], to: item.r[1] } };
                    });
                    ServiceStreams.pushToStreamFileMap(this._session, converted);
                    ServiceStreams.updatePipeSession(converted[map.length - 1].bytes.to, this._session);
                });
                lvin.merge(
                    this._files.map((file: IFile) => {
                        return {
                            file: file.file,
                            offset: file.offset,
                            sourceId: this._sourceIds[file.file].toString(),
                            year: file.year,
                            format: file.format,
                        } as IFileToBeMerged;
                    }),
                    {
                        destFile: sessionData.file,
                    },
                ).then(() => {
                    lvin.removeAllListeners();
                    ServiceStreams.removePipeSession(this._writeSessionsId);
                    resolve(size);
                }).catch((error: Error) => {
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
