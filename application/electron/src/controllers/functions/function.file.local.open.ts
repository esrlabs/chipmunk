import { dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import ServiceStreams from '../../services/service.streams';
import ServiceStreamSource from '../../services/service.stream.sources';
import { AFileParser, IReadWriteResult, IMapItem } from '../files.parsers/interface';
import * as Tools from '../../tools/index';
import Logger from '../../tools/env.logger';
import ServiceElectron, { IPCMessages } from '../../services/service.electron';

export default class FunctionOpenLocalFile {

    private _parser: AFileParser;
    private _logger: Logger;
    private _options: any;

    constructor(parser: AFileParser) {
        this._parser = parser;
        this._logger = new Logger(`Parser "${parser.getName()}"`);
    }

    public getLabel(): string {
        return `Open Local file: ${this._parser.getName()}`;
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
                fs.stat(file, (error: NodeJS.ErrnoException | null, stats: fs.Stats) => {
                    if (error) {
                        return;
                    }
                    // Request options to open file
                    this._getOptions(file, path.basename(file), this._parser.getAlias(), stats.size).then((options: any) => {
                        const pipeSessionId: string = Tools.guid();
                        ServiceStreams.addPipeSession(pipeSessionId, stats.size, file);
                        if (!this.hasDirectReadWrite()) {
                            // Pipe file. No direct read/write method
                            this._pipeSource(file).then(() => {
                                ServiceStreams.removePipeSession(pipeSessionId);
                            }).catch((pipeError: Error) => {
                                this._logger.error(`Fail to pipe file "${file}" due error: ${pipeError.message}`);
                            });
                        } else {
                            // Trigger progress
                            ServiceStreams.updatePipeSession(0);
                            // Parser has direct method of reading and writing
                            this._directReadWrite(file).then(() => {
                                ServiceStreams.removePipeSession(pipeSessionId);
                            }).catch((pipeError: Error) => {
                                this._logger.error(`Fail to directly read file "${file}" due error: ${pipeError.message}`);
                            });
                        }
                    }).catch((getOptionsError: Error) => {
                        this._logger.error(`File "${file}" (${this._parser.getAlias()}) will not be opened due error: ${getOptionsError.message}`);
                    });
                });
            });
        };
    }

    public hasDirectReadWrite(): boolean {
        return this._parser.readAndWrite !== undefined;
    }

    private _getOptions(fullFileName: string, fileName: string, type: string, size: number ): Promise<any> {
        return new Promise((resolve, reject) => {
            ServiceElectron.IPC.request(new IPCMessages.FileGetOptionsRequest({
                fileName: fileName,
                fullFileName: fullFileName,
                type: type,
                size: size,
                session: ServiceStreams.getActiveStreamId(),
            }), IPCMessages.FileGetOptionsResponse).then((response: IPCMessages.FileGetOptionsResponse) => {
                if (!response.allowed) {
                    return reject();
                }
                this._options = response.options;
                resolve(response.options);
            }).catch((error: Error) => {
                this._options = undefined;
                reject(error);
            });
        });
    }

    private _pipeSource(file: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Add new description of source
            const sourceId: number = ServiceStreamSource.add({ name: path.basename(file) });
            // Create read stream
            const reader: fs.ReadStream = fs.createReadStream(file);
            // Pipe file
            ServiceStreams.pipeWith({
                reader: reader,
                sourceId: sourceId,
                decoder: this._parser.getTransform(this._options),
            }).then(() => {
                reader.close();
                resolve();
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    private _directReadWrite(file: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Add new description of source
            const sourceId: number = ServiceStreamSource.add({ name: path.basename(file) });
            // Get destination file
            const dest: { streamId: string, file: string } | Error = ServiceStreams.getStreamFile();
            if (dest instanceof Error) {
                return reject(dest);
            }
            if (this._parser.readAndWrite === undefined) {
                return reject(new Error(`This case isn't possible, but typescript compile.`));
            }
            this._parser.readAndWrite(file, dest.file, sourceId, (map: IMapItem[]) => {
                ServiceStreams.pushToStreamFileMap(dest.streamId, map);
                ServiceStreams.updatePipeSession(map[map.length - 1].bytes.to, dest.streamId);
            }).then((map: IMapItem[]) => {
                // Doesn't need to update map here, because it's updated on fly
                // Notify render
                resolve();
            }).catch((error: Error) => {
                reject(error);
            });
        });

    }

}
