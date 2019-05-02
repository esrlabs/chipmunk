import ServiceElectron, { IPCMessages } from './service.electron';
import { FileParsers, AFileParser } from '../controllers/files.parsers/index';
import Logger from '../tools/env.logger';
import * as path from 'path';
import { Subscription } from '../tools/index';
import { IService } from '../interfaces/interface.service';

/**
 * @class ServiceFileParsers
 * @description Providers access to file parsers from render
 */

class ServiceFileParsers implements IService {

    private _logger: Logger = new Logger('ServiceFileParsers');
    // Should detect by executable file
    private _subscription: { [key: string]: Subscription } = {};

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectron.IPC.subscribe(IPCMessages.FileGetParserRequest, this._onFileGetParserRequest.bind(this)).then((subscription: Subscription) => {
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
        return 'ServiceFileParsers';
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

    private _onFileGetParserRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.FileGetParserRequest = request as IPCMessages.FileGetParserRequest;
        let parserName: string | undefined;
        FileParsers.forEach((parser) => {
            if (parserName !== undefined) {
                return;
            }
            const inst = new parser.class();
            if (inst.isSupported(req.file)) {
                parserName = parser.name;
            }
        });
        if (parserName === undefined) {
            return response(new IPCMessages.FileGetParserResponse({
                file: req.file,
                shortname: path.basename(req.file),
                parsers: FileParsers.map((parser) => {
                    return {
                        name: parser.name,
                        desc: parser.desc,
                    };
                }),
            }));
        }
        response(new IPCMessages.FileGetParserResponse({
            file: req.file,
            shortname: path.basename(req.file),
            parser: parserName,
        }));
    }

}

export default (new ServiceFileParsers());
