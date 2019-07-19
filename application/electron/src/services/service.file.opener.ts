import ServiceElectron, { IPCMessages } from './service.electron';
import ServiceStreams from '../services/service.streams';
import ServiceStreamSource from '../services/service.stream.sources';
import { FileParsers, AFileParser } from '../controllers/files.parsers/index';
import { IMapItem } from '../controllers/files.parsers/interface';
import Logger from '../tools/env.logger';
import * as Tools from '../tools/index';
import * as fs from 'fs';
import * as path from 'path';
import { Subscription } from '../tools/index';
import { IService } from '../interfaces/interface.service';

/**
 * @class ServiceFileOpener
 * @description Opens files dropped on render
 */

class ServiceFileOpener implements IService {

    private _logger: Logger = new Logger('ServiceFileOpener');
    // Should detect by executable file
    private _subscription: { [key: string]: Subscription } = {};
    private _options: any;

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectron.IPC.subscribe(IPCMessages.FileOpenRequest, this._onFileOpenRequest.bind(this)).then((subscription: Subscription) => {
                this._subscription.FileOpenRequest = subscription;
                resolve();
            }).catch((error: Error) => {
                this._logger.error(`Fail to init module due error: ${error.message}`);
                reject(error);
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscription).forEach((key: string) => {
                this._subscription[key].destroy();
            });
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceFileOpener';
    }

    public open(file: string, session: string, parser?: AFileParser): Promise<void> {
        return new Promise((resolve, reject) => {
            fs.stat(file, (error: NodeJS.ErrnoException | null, stats: fs.Stats) => {
                if (error) {
                    return reject(error);
                }
                parser = parser === undefined ? this._getFileParser(file) : parser;
                if (parser === undefined) {
                    return reject(new Error(`Fail to find parser for file`));
                }
                // Request options to open file
                this._getOptions(file, path.basename(file), parser, stats.size).then((options: any) => {
                    const pipeSessionId: string = Tools.guid();
                    ServiceStreams.addPipeSession(pipeSessionId, stats.size, file);
                    if ((parser as AFileParser).readAndWrite === undefined) {
                        // Pipe file. No direct read/write method
                        this._pipeSource(file, session, (parser as AFileParser), options).then(() => {
                            ServiceStreams.removePipeSession(pipeSessionId);
                            resolve();
                        }).catch((pipeError: Error) => {
                            ServiceStreams.removePipeSession(pipeSessionId);
                            reject(new Error(this._logger.error(`Fail to pipe file "${file}" due error: ${pipeError.message}`)));
                        });
                    } else {
                        // Trigger progress
                        ServiceStreams.updatePipeSession(0);
                        // Parser has direct method of reading and writing
                        this._directReadWrite(file, session, (parser as AFileParser), options).then(() => {
                            ServiceStreams.removePipeSession(pipeSessionId);
                            ServiceStreams.reattachSessionFileHandle();
                            resolve();
                        }).catch((pipeError: Error) => {
                            ServiceStreams.removePipeSession(pipeSessionId);
                            ServiceStreams.reattachSessionFileHandle();
                            reject(new Error(this._logger.error(`Fail to directly read file "${file}" due error: ${pipeError.message}`)));
                        });
                    }
                }).catch((getOptionsError: Error) => {
                    reject(new Error(this._logger.error(`File "${file}" (${(parser as AFileParser).getAlias()}) will not be opened due error: ${getOptionsError.message}`)));
                });
            });
        });
    }

    private _onFileOpenRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.FileReadRequest = request as IPCMessages.FileReadRequest;
        this.open(req.file, req.session).then(() => {
            response(new IPCMessages.FileOpenResponse({}));
        }).catch((openError: Error) => {
            response(new IPCMessages.FileOpenResponse({
                error: openError.message,
            }));
        });
    }

    private _getFileParser(file: string): AFileParser | undefined {
        let parser: AFileParser | undefined;
        FileParsers.forEach((desc) => {
            if (parser !== undefined) {
                return;
            }
            parser = new desc.class();
            if (parser !== undefined && !parser.isSupported(file)) {
                parser = undefined;
            }
        });
        return parser;
    }

    private _getOptions(fullFileName: string, fileName: string, parser: AFileParser, size: number ): Promise<any> {
        return new Promise((resolve, reject) => {
            ServiceElectron.IPC.request(new IPCMessages.FileGetOptionsRequest({
                fileName: fileName,
                fullFileName: fullFileName,
                type: parser.getAlias(),
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

    private _pipeSource(file: string, session: string, parser: AFileParser, options: any): Promise<void> {
        return new Promise((resolve, reject) => {
            // Add new description of source
            const sourceId: number = ServiceStreamSource.add({ name: path.basename(file), session: session });
            // Create read stream
            const reader: fs.ReadStream = fs.createReadStream(file);
            // Pipe file
            ServiceStreams.pipeWith({
                reader: reader,
                sourceId: sourceId,
                decoder: parser.getTransform(this._options),
            }).then(() => {
                reader.close();
                resolve();
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    private _directReadWrite(file: string, session: string, parser: AFileParser, options: { [key: string]: any }): Promise<void> {
        return new Promise((resolve, reject) => {
            // Add new description of source
            const sourceId: number = ServiceStreamSource.add({ name: path.basename(file), session: session });
            // Get destination file
            const dest: { streamId: string, file: string } | Error = ServiceStreams.getStreamFile();
            if (dest instanceof Error) {
                return reject(dest);
            }
            if (parser.readAndWrite === undefined) {
                return reject(new Error(`This case isn't possible, but typescript compile.`));
            }
            parser.readAndWrite(file, dest.file, sourceId, options, (map: IMapItem[]) => {
                ServiceStreams.pushToStreamFileMap(dest.streamId, map);
                ServiceStreams.updatePipeSession(map[map.length - 1].bytes.to - map[0].bytes.from, dest.streamId);
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

export default (new ServiceFileOpener());
