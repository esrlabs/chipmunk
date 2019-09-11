import ServiceElectron, { IPCMessages } from './service.electron';
import { FileParsers, AFileParser, getParserForFile, getDefaultFileParser } from '../controllers/files.parsers/index';
import Logger from '../tools/env.logger';
import * as path from 'path';
import { Subscription } from '../tools/index';
import { IService } from '../interfaces/interface.service';
import * as fs from 'fs';

/**
 * @class ServiceFileInfo
 * @description Providers access to file parsers from render
 */

class ServiceFileInfo implements IService {

    private _logger: Logger = new Logger('ServiceFileInfo');
    // Should detect by executable file
    private _subscription: { [key: string]: Subscription } = {};

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectron.IPC.subscribe(IPCMessages.FileInfoRequest, this._onFileInfoRequest.bind(this)).then((subscription: Subscription) => {
                this._subscription.FileGetParserRequest = subscription;
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
        return 'ServiceFileInfo';
    }

    public getParser(name: string): any {
        let parserClass: any;
        FileParsers.forEach((parser) => {
            if (parserClass !== undefined) {
                return;
            }
            if (name === parser.name) {
                parserClass = parser.class;
            }
        });
        return parserClass;
    }

    private _onFileInfoRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.FileInfoRequest = request as IPCMessages.FileInfoRequest;
        const info: { size: number, created: number; changed: number } = { size: -1, created: -1, changed: -1 };
        const defaults: AFileParser | undefined = getDefaultFileParser();
        const noParserFoundResponce = () => {
            response(new IPCMessages.FileInfoResponse({
                path: req.file,
                name: path.basename(req.file),
                parsers: FileParsers.map((parser) => {
                    return {
                        name: parser.name,
                        desc: parser.desc,
                    };
                }),
                defaults: defaults !== undefined ? defaults.getName() : undefined,
                size: info.size,
                created: info.created,
                changed: info.changed,
            }));
        };
        if (fs.existsSync(req.file)) {
            const stats: fs.Stats = fs.statSync(req.file);
            info.size = stats.size;
            info.created = stats.birthtimeMs;
            info.changed = stats.mtimeMs;
        }
        getParserForFile(req.file).then((parser: AFileParser | undefined) => {
            if (parser === undefined) {
                return noParserFoundResponce();
            }
            response(new IPCMessages.FileInfoResponse({
                path: req.file,
                name: path.basename(req.file),
                parser: parser.getName(),
                size: info.size,
                defaults: defaults !== undefined ? defaults.getName() : undefined,
                created: info.created,
                changed: info.changed,
            }));
        }).catch((gettingParserError: Error) => {
            this._logger.warn(`Fail to find parser for file "${req.file}" due error: ${gettingParserError.message}`);
            noParserFoundResponce();
        });
    }

}

export default (new ServiceFileInfo());
