import ServiceElectron, { IPCMessages } from '../service.electron';
import ServiceStreams from '../service.streams';
import ServiceStreamSource from '../service.stream.sources';
import ServiceHotkeys from '../service.hotkeys';
import ServiceFileRecent from './service.file.recent';
import Logger from '../../tools/env.logger';

import { IMapItem, ITicks } from '../../controllers/files.parsers/interface';
import { dialog, OpenDialogReturnValue } from 'electron';
import { getDefaultFileParser, AFileParser, getParserForFile } from '../../controllers/files.parsers/index';
import { Subscription } from '../../tools/index';
import { IService } from '../../interfaces/interface.service';
import { isHidden } from '../../tools/fs';

import * as Tools from '../../tools/index';
import * as fs from 'fs';
import * as path from 'path';

interface IOpenFileResult {
    sourceId: number;
    options: any;
}

/**
 * @class ServiceFileOpener
 * @description Opens files dropped on render
 */

class ServiceFileOpener implements IService {

    private _logger: Logger = new Logger('ServiceFileOpener');
    // Should detect by executable file
    private _subscriptions: { [key: string]: Subscription } = {};
    private _active: Map<string, AFileParser> = new Map<string, AFileParser>();

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all([
                ServiceElectron.IPC.subscribe(IPCMessages.FileOpenRequest, this._ipc_FileOpenRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.FileOpenRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.FileListRequest, this._ipc_FileListRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.FileListRequest = subscription;
                }),
            ]).then(() => {
                this._subscriptions.onSessionClosed = ServiceStreams.getSubjects().onSessionClosed.subscribe(this._onSessionClosed.bind(this));
                this._subscriptions.openLocalFile = ServiceHotkeys.getSubject().openLocalFile.subscribe(this._hotkey_openLocalFile.bind(this));
                resolve();
            }).catch((error: Error) => {
                this._logger.error(`Fail to init module due error: ${error.message}`);
                reject(error);
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].destroy();
            });
            if (this._active.size === 0) {
                return resolve();
            }
            Promise.all(Array.from(this._active.values()).map((task: AFileParser) => {
                return task.abort();
            })).catch((error: Error) => {
                this._logger.error(`Fail to abort active tasks due error: ${error.message}`);
            }).finally(() => {
                resolve();
            });
        });
    }

    public getName(): string {
        return 'ServiceFileOpener';
    }

    public open(file: string, sessionId: string, parser?: AFileParser, opts?: any): Promise<IOpenFileResult> {
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
                    // To resolve TS type checks, we need this here.
                    const instanceParser: AFileParser = detectedParser;
                    // Create file opener
                    const open = (options: any) => {
                        if (typeof options === 'boolean') {
                            this._logger.debug(`User canceled opening file.`);
                            return resolve({ sourceId: -1, options: undefined });
                        }
                        const trackingId: string = Tools.guid();
                        this._setProgress(instanceParser, trackingId, file);
                        // Trigger progress
                        this._incrProgress(instanceParser, trackingId, sessionId, 0);
                        // Store parser
                        this._active.set(sessionId, instanceParser);
                        // Send notification about opening
                        ServiceElectron.IPC.send(new IPCMessages.FileOpenInprogressEvent({
                            session: sessionId,
                            file: file,
                        })).catch((progressNotificationErr: Error) => {
                            this._logger.warn(`Fail notify render about starting of opening file "${file}" due error: ${progressNotificationErr.message}`);
                        });
                        // Parser has direct method of reading and writing
                        this._directReadWrite(file, sessionId, instanceParser, options, trackingId).then((sourceId: number) => {
                            instanceParser.destroy().then(() => {
                                // Save recent
                                ServiceFileRecent.save(file, stats.size);
                                // Get meta file info
                                const info = ServiceStreamSource.get(sourceId);
                                if (info !== undefined) {
                                    (info as IPCMessages.IStreamSourceNew).id = sourceId;
                                }
                                // Send meta info data
                                ServiceElectron.IPC.send(new IPCMessages.FileOpenDoneEvent({
                                    session: sessionId,
                                    file: file,
                                    stream: info as IPCMessages.IStreamSourceNew,
                                    options: options,
                                })).catch((confirmNotificationErr: Error) => {
                                    this._logger.warn(`Fail notify render about opening file "${file}" due error: ${confirmNotificationErr.message}`);
                                });
                                // Bound filename with session
                                ServiceStreams.addBoundFile(sessionId, file);
                                // Resolve
                                resolve({ sourceId: sourceId, options: options });
                            });
                        }).catch((pipeError: Error) => {
                            instanceParser.destroy().then(() => {
                                reject(new Error(this._logger.error(`Fail to directly read file "${file}" due error: ${pipeError.message}`)));
                            });
                        }).cancel(() => {
                            this._logger.debug(`Reading operation with "${instanceParser.getAlias()}" was canceled`);
                        }).finally(() => {
                            this._unsetProgress(instanceParser, trackingId, sessionId);
                            ServiceStreams.reattachSessionFileHandle(sessionId);
                            this._active.delete(sessionId);
                        });
                    };
                    if (opts !== undefined) {
                        // Options are delivered already
                        open(opts);
                    } else {
                        // Request options to open file
                        this._getOptions(file, path.basename(file), instanceParser, stats.size).then((options: any) => {
                            open(options);
                        }).catch((getOptionsError: Error) => {
                            reject(new Error(this._logger.error(`File "${file}" (${instanceParser.getAlias()}) will not be opened due error: ${getOptionsError.message}`)));
                        });
                    }
                }).catch((gettingParserError: Error) => {
                    reject(new Error(this._logger.warn(`Fail to find parser due error: ${gettingParserError.message}`)));
                });
            });
        });
    }

    public openAsNew(file: string): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectron.IPC.request(new IPCMessages.RenderSessionAddRequest(), IPCMessages.RenderSessionAddResponse).then((response: IPCMessages.RenderSessionAddResponse) => {
                if (response.error !== undefined) {
                    this._logger.warn(`Fail to add new session for file "${file}" due error: ${response.error}`);
                    return reject(new Error(response.error));
                }
                this.open(file, response.session).then(() => {
                    resolve();
                }).catch((openFileErr: Error) => {
                    this._logger.warn(`Fail to open file "${file}" due error: ${openFileErr.message}`);
                    reject(openFileErr);
                });
            }).catch((addSessionErr: Error) => {
                this._logger.warn(`Fail to add new session for file "${file}" due error: ${addSessionErr.message}`);
                reject(addSessionErr);
            });

        });
    }

    public selectAndOpenFile(): Promise<string | undefined> {
        return this._openFile();
    }

    private _ipc_FileListRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.FileListRequest = request as IPCMessages.FileListRequest;
        Promise.all(
            req.files.map((file: string) => {
                return this._listFiles(file);
        })).then((fileLists: IPCMessages.IFile[][]) => {
            response(new IPCMessages.FileListResponse({
                files: this._concatFileList(fileLists),
            })).catch((error: Error) => {
                this._logger.error(`Fail to respond to files ${req.files} due error: ${error.message}`);
            });
        }).catch((error: Error) => {
            response(new IPCMessages.FileListResponse({
                files: [],
                error: error.message,
            }));
        });
    }

    private _concatFileList(fileLists: IPCMessages.IFile[][]): IPCMessages.IFile[] {
        const cConcatFiles: IPCMessages.IFile[] = [];
        return cConcatFiles.concat(...fileLists);
    }

    private _ipc_FileOpenRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.FileOpenRequest = request as IPCMessages.FileOpenRequest;
        this.open(req.file, req.session, undefined, req.options).then((result: IOpenFileResult) => {
            const info = ServiceStreamSource.get(result.sourceId);
            if (info !== undefined) {
                (info as IPCMessages.IStreamSourceNew).id = result.sourceId;
            }
            response(new IPCMessages.FileOpenResponse({
                stream: info as IPCMessages.IStreamSourceNew,
                options: result.options,
            }));
        }).catch((openError: Error) => {
            response(new IPCMessages.FileOpenResponse({
                error: openError.message,
                stream: undefined,
            }));
        });
    }

    private _listFiles(startFile: string): Promise<IPCMessages.IFile[]> {
        return new Promise((resolve, reject) => {
            const allFiles: IPCMessages.IFile[] = [];
            const self = this;

            function listAllFiles(file: string): Promise<any> {
                return new Promise((resolved, rejected) => {
                    fs.lstat(file, (lsErr, stats) => {
                        if (lsErr) {
                            return resolved(allFiles.push({
                                hasParser: false,
                                isHidden: false,
                                lastModified: 0,
                                lastModifiedDate: new Date(),
                                name: path.basename(file),
                                path: file,
                                size: 0,
                                type: 'file',
                                checked: false,
                                disabled: true,
                            }));
                        }
                        if (stats.isFile()) {
                            // File
                            if (stats.size === 0) {
                                return resolved(allFiles.push({
                                    hasParser: false,
                                    isHidden: false,
                                    lastModified: stats.mtimeMs,
                                    lastModifiedDate: stats.mtime,
                                    name: path.basename(file),
                                    path: file,
                                    size: stats.size,
                                    type: 'file',
                                    checked: false,
                                    disabled: true,
                                }));
                            }
                            Promise.all([getParserForFile(file), isHidden(file)]).then((values: [AFileParser | undefined, boolean | undefined]) => {
                                const parser = values[0];
                                const hideStatus = (values[1] === undefined) ? false : values[1];
                                return resolved(allFiles.push({
                                    hasParser: (parser === undefined) ? false : true,
                                    isHidden: hideStatus,
                                    lastModified: stats.mtimeMs,
                                    lastModifiedDate: stats.mtime,
                                    name: path.basename(file),
                                    path: file,
                                    size: stats.size,
                                    type: 'file',
                                    checked: (parser === undefined || hideStatus) ? false : true,
                                    disabled: false,
                                }));
                            }).catch((error: Error) => {
                                self._logger.warn(`Fail to indentify parser of ${file} due to error: ${error.message}`);
                                return resolved(allFiles.push({
                                    hasParser: false,
                                    isHidden: false,
                                    lastModified: stats.mtimeMs,
                                    lastModifiedDate: stats.mtime,
                                    name: path.basename(file),
                                    path: file,
                                    size: stats.size,
                                    type: 'file',
                                    checked: false,
                                    disabled: true,
                                }));
                            });
                        } else if (!(stats.isDirectory())) {
                            // Neither file nor directory
                            return rejected(new Error(self._logger.warn(`Fail to get file info of ${file} because it is neither a file nor a directory`)));
                        } else {
                            // Directory
                            return fs.readdir(file, (err, files) => {
                                if (err) {
                                    self._logger.warn(`Fail to list files of directory ${file} due to error: ${err.message}`);
                                    return resolved();
                                } else {
                                    Promise.all(files.map((subFile: string) => {
                                        return listAllFiles(file + '/' + subFile);
                                    })).then(() => {
                                        resolved(allFiles);
                                    }).catch((error: Error) => {
                                        rejected(new Error(self._logger.warn(`Fail to list files of directory ${file} info due to error: ${error.message}`)));
                                    });
                                }
                            });
                        }
                    });
                });
            }
            listAllFiles(startFile).then(() => {
                resolve(allFiles);
            }).catch((error: Error) => {
                reject(new Error(self._logger.warn(`Fail to list files of directory ${startFile} info due to error: ${error.message}`)));
            });
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
                    return resolve(false);
                }
                resolve(response.options);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    private _directReadWrite(file: string, sessionId: string, parser: AFileParser, options: { [key: string]: any }, trackingId: string): Tools.CancelablePromise<number, void> {
        return new Tools.CancelablePromise<number, void>((resolve, reject, cancel) => {
            // Add new description of source
            const sourceId: number = ServiceStreamSource.add({ name: path.basename(file), session: sessionId, meta: parser.getMeta() });
            // Get destination file
            const dest: { streamId: string, file: string } | Error = ServiceStreams.getStreamFile();
            if (dest instanceof Error) {
                return reject(dest);
            }
            if (parser.parseAndIndex === undefined) {
                return reject(new Error(`This case isn't possible, but typescript compile.`));
            }
            parser.parseAndIndex(file, dest.file, sourceId, options, (map: IMapItem[]) => {
                ServiceStreams.pushToStreamFileMap(dest.streamId, map);
            }, (ticks: ITicks) => {
                this._incrProgress(parser, trackingId, dest.streamId, ticks.ellapsed / ticks.total);
            }).then((map: IMapItem[]) => {
                // Doesn't need to update map here, because it's updated on fly
                // Notify render
                resolve(sourceId);
            }).cancel(() => {
                cancel();
            }).catch((error: Error) => {
                reject(error);
            });
        });

    }

    private _openFile(parser?: AFileParser): Promise<string | undefined> {
        return new Promise((resolve, reject) => {
            const win = ServiceElectron.getBrowserWindow();
            if (win === undefined) {
                return reject(new Error(`No window found`));
            }
            if (parser !== undefined) {
                dialog.showOpenDialog(win, {
                    properties: ['openFile', 'showHiddenFiles'],
                    filters: parser.getExtnameFilters(),
                }).then((returnValue: OpenDialogReturnValue) => {
                    if (!(returnValue.filePaths instanceof Array) || returnValue.filePaths.length !== 1) {
                        return resolve(undefined);
                    }
                    const file: string = returnValue.filePaths[0];
                    this.open(file, ServiceStreams.getActiveStreamId(), parser).then(() => {
                        resolve(file);
                    }).catch((error: Error) => {
                        this._logger.warn(`Fail open file due error: ${error.message}`);
                        reject(new Error(`Fail open file due error: ${error.message}`));
                    });
                }).catch((error: Error) => {
                    this._logger.error(`Fail open file due error: ${error.message}`);
                    reject(new Error(`Fail open file due error: ${error.message}`));
                });
            } else {
                dialog.showOpenDialog(win, {
                    properties: ['openFile', 'showHiddenFiles'],
                    filters: [ { name: 'All Files', extensions: ['*'] } ],
                }).then((returnValue: OpenDialogReturnValue) => {
                    if (!(returnValue.filePaths instanceof Array) || returnValue.filePaths.length !== 1) {
                        return resolve(undefined);
                    }
                    const filename: string = returnValue.filePaths[0];
                    getParserForFile(filename).then((_parser: AFileParser | undefined) => {
                        if (_parser === undefined) {
                            this._logger.error(`Fail to find a parser for file: ${filename}`);
                            return reject(new Error(`Fail to find a parser for file: ${filename}`));
                        }
                        ServiceElectron.IPC.request(new IPCMessages.RenderSessionAddRequest(), IPCMessages.RenderSessionAddResponse).then((response: IPCMessages.RenderSessionAddResponse) => {
                            if (response.error !== undefined) {
                                this._logger.warn(`Fail to add new session for file "${filename}" due error: ${response.error}`);
                                return reject(new Error(`Fail to add new session for file "${filename}" due error: ${response.error}`));
                            }
                            this.open(filename, response.session, _parser).then(() => {
                                resolve(filename);
                            }).catch((error: Error) => {
                                this._logger.warn(`Fail open file "${filename}" due error: ${error.message}`);
                                reject(new Error(`Fail open file "${filename}" due error: ${error.message}`));
                            });
                        }).catch((addSessionErr: Error) => {
                            this._logger.warn(`Fail to add new session for file "${filename}" due error: ${addSessionErr.message}`);
                            reject(new Error(`Fail to add new session for file "${filename}" due error: ${addSessionErr.message}`));
                        });
                    }).catch((error: Error) => {
                        this._logger.error(`Error to open file "${filename}" due error: ${error.message}`);
                        reject(new Error(`Error to open file "${filename}" due error: ${error.message}`));
                    });
                }).catch((error: Error) => {
                    this._logger.error(`Fail open file due error: ${error.message}`);
                    reject(new Error(`Fail open file due error: ${error.message}`));
                });
            }
        });
    }

    private _hotkey_openLocalFile() {
        this._openFile().catch((error: Error) => {
            this._logger.error(`Fail open file on CMD + P: ${error.message}`);
        });
    }

    private _setProgress(parser: AFileParser, trackingId: string, file: string) {
        ServiceStreams.addProgressSession(trackingId, file);
    }

    private _unsetProgress(parser: AFileParser, trackingId: string, sessionId: string) {
        ServiceStreams.removeProgressSession(trackingId, sessionId);
    }

    private _incrProgress(parser: AFileParser, trackingId: string, sessionId: string, value: number) {
        ServiceStreams.updateProgressSession(trackingId, value, sessionId);
    }

    private _onSessionClosed(guid: string) {
        // Check for active tasks for session
        const task: AFileParser | undefined = this._active.get(guid);
        if (task === undefined) {
            // No any active tasks for closed session
            return;
        }
        task.abort().then(() => {
            this._logger.debug(`Session "${guid}" is closed. Task "${task.getAlias()}" is aborted.`);
        });
    }

}

export default (new ServiceFileOpener());
