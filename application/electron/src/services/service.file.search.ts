import ServiceElectron, { IPCMessages } from './service.electron';
import ServicePaths from './service.paths';
import Logger from '../tools/env.logger';
import { Subscription } from '../tools/index';
import { IService } from '../interfaces/interface.service';
import { spawn, ChildProcess } from 'child_process';

/**
 * @class ServiceFileSearch
 * @description Providers access to file parsers from render
 */

class ServiceFileSearch implements IService {

    private _logger: Logger = new Logger('ServiceFileSearch');
    private _cmd: string = '';
    // Should detect by executable file
    private _subscription: { [key: string]: Subscription } = {};

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._cmd = ServicePaths.getRG();
            ServiceElectron.IPC.subscribe(IPCMessages.FilesSearchRequest, this._onFilesSearchRequest.bind(this)).then((subscription: Subscription) => {
                this._subscription.FilesSearchRequest = subscription;
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
        return 'ServiceFileSearch';
    }

    private _onFilesSearchRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.FilesSearchRequest = request as IPCMessages.FilesSearchRequest;
        this._getMatchesCount(req.files, req.requests.map((r) => {
            return new RegExp(r.source, r.flags);
        })).then((matches: { [key: string]: number }) => {
            response(new IPCMessages.FilesSearchResponse({
                matches: matches,
            }));
        }).catch((error: Error) => {
            response(new IPCMessages.FilesSearchResponse({
                matches: {},
                error: error.message,
            }));
        });
    }

    private _getMatchesCount(files: string[], regExp: RegExp | RegExp[]): Promise<{ [key: string]: number }> {
        return new Promise((resolve, reject) => {
            setImmediate(() => {
                if (!(regExp instanceof Array)) {
                    regExp = [regExp];
                }
                const args: string[] = [
                    '--count',
                    '--text', // https://github.com/BurntSushi/ripgrep/issues/306 this issue is about a case, when not printable symble is in a file
                    '-i',
                    '-e',
                    `(${regExp.map(r => r.source).join('|')})`,
                ];
                args.push(...files);
                let output: string = '';
                let errors: string = '';
                const process: ChildProcess = spawn(this._cmd, args, {
                    stdio: [ 'pipe', 'pipe', 'pipe' ],
                });
                process.stdout.on('data', (chunk: Buffer | string) => {
                    if (chunk instanceof Buffer) {
                        chunk = chunk.toString();
                    }
                    if (typeof chunk !== 'string') {
                        return;
                    }
                    output += chunk;
                });
                process.stderr.on('data', (chunk: Buffer | string) => {
                    if (chunk instanceof Buffer) {
                        chunk = chunk.toString();
                    }
                    if (typeof chunk !== 'string') {
                        return;
                    }
                    errors += chunk;
                });
                process.once('close', () => {
                    if (errors.trim() !== '') {
                        return reject(new Error(this._logger.warn(`Fail to make search due error: ${errors}`)));
                    }
                    const results: { [key: string]: number } = {};
                    output.split(/[\n\r]/).forEach((result: string) => {
                        const parts: string[] = result.split(':');
                        if (parts.length !== 2) {
                            return this._logger.warn(`Fail to parser RG result line: ${result}`);
                        }
                        results[parts[0]] = parseInt(parts[1], 10);
                    });
                    resolve(results);
                });
                process.once('error', (error: Error) => {
                    this._logger.error(`Error during calling rg: ${error.message}`);
                    reject(error);
                });
            });
        });
    }

}

export default (new ServiceFileSearch());
