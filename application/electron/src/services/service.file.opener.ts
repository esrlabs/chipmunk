import ServiceElectron, { IPCMessages } from './service.electron';
import ServiceStreams from '../services/service.streams';
import ServiceStreamSource from '../services/service.stream.sources';
import ServiceHotkeys from '../services/service.hotkeys';
import { getDefaultFileParser, AFileParser, getParserForFile } from '../controllers/files.parsers/index';
import FileParserText from '../controllers/files.parsers/file.parser.text';
import FileParserDlt from '../controllers/files.parsers/file.parser.dlt';
import { IMapItem } from '../controllers/files.parsers/interface';
import { dialog } from 'electron';
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
            this._subscription.openTextFile = ServiceHotkeys.getSubject().openTextFile.subscribe(this._hotkey_openTextFile.bind(this));
            this._subscription.openDltFile = ServiceHotkeys.getSubject().openDltFile.subscribe(this._hotkey_openDltFile.bind(this));
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
                getParserForFile(file, parser).then((detectedParser: AFileParser | undefined) => {
                    if (detectedParser === undefined) {
                        detectedParser = getDefaultFileParser();
                    }
                    if (detectedParser === undefined) {
                        return reject(new Error(this._logger.warn(`Fail to find parser for file "${file}"`)));
                    }
                    // Request options to open file
                    this._getOptions(file, path.basename(file), detectedParser, stats.size).then((options: any) => {
                        detectedParser = detectedParser as AFileParser;
                        const pipeSessionId: string = Tools.guid();
                        ServiceStreams.addPipeSession(pipeSessionId, stats.size, file);
                        if (detectedParser.readAndWrite === undefined) {
                            // Pipe file. No direct read/write method
                            this._pipeSource(file, session, detectedParser, options).then(() => {
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
                            this._directReadWrite(file, session, detectedParser, options).then(() => {
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
                        reject(new Error(this._logger.error(`File "${file}" (${(detectedParser as AFileParser).getAlias()}) will not be opened due error: ${getOptionsError.message}`)));
                    });
                }).catch((gettingParserError: Error) => {
                    reject(new Error(this._logger.warn(`Fail to find parser due error: ${gettingParserError.message}`)));
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

    private _openFile(parser: AFileParser) {
        dialog.showOpenDialog({
            properties: ['openFile', 'showHiddenFiles'],
            filters: parser.getExtnameFilters(),
        }, (files: string[] | undefined) => {
            if (!(files instanceof Array) || files.length !== 1) {
                return;
            }
            const file: string = files[0];
            this.open(file, ServiceStreams.getActiveStreamId(), parser).catch((error: Error) => {
                this._logger.warn(`Fail open file due error: ${error.message}`);
            });
        });
    }

    private _hotkey_openTextFile() {
        this._openFile(new FileParserText());
    }

    private _hotkey_openDltFile() {
        this._openFile(new FileParserDlt());
    }

}

export default (new ServiceFileOpener());
