import * as Toolkit from 'chipmunk.client.toolkit';

import ElectronIpcService from './service.electron.ipc';

import { IPC, Subscription } from './service.electron.ipc';
import { IService } from '../interfaces/interface.service';
import { setGlobalLogLevel, setGlobalLogCallback, ELogLevels } from 'chipmunk.client.toolkit';

export class LogsService implements IService {
    private _logger: Toolkit.Logger = new Toolkit.Logger('LogsService');
    private _subscriptions: { [key: string]: Subscription } = {};
    private _level: IPC.ELogLevels = IPC.ELogLevels.WARNING;
    private _production: boolean = true;

    constructor() {}

    public init(): Promise<void> {
        return new Promise((resolve) => {
            Promise.all([
                ElectronIpcService.request<IPC.ChipmunkLogLevelResponse>(
                    new IPC.ChipmunkLogLevelRequest(),
                    IPC.ChipmunkLogLevelResponse,
                )
                    .then((response) => {
                        const levels: Toolkit.ELogLevels[] = [
                            Toolkit.ELogLevels.DEBUG,
                            Toolkit.ELogLevels.WARNING,
                            Toolkit.ELogLevels.ERROR,
                            Toolkit.ELogLevels.ENV,
                            Toolkit.ELogLevels.INFO,
                            Toolkit.ELogLevels.VERBOS,
                        ];
                        if (levels.indexOf(response.level) === -1) {
                            this._logger.warn(
                                `Unknown log level: ${response.level}. Will be used default: ${Toolkit.ELogLevels.WARNING}.`,
                            );
                        } else {
                            this._level = response.level;
                        }
                    })
                    .catch((err: Error) => {
                        this._logger.warn(`Fail request log level due error: ${err.message}`);
                    }),
                ElectronIpcService.request<IPC.ChipmunkDevModeResponse>(
                    new IPC.ChipmunkDevModeRequest(),
                    IPC.ChipmunkDevModeResponse,
                )
                    .then((response) => {
                        this._production = response.production;
                    })
                    .catch((err: Error) => {
                        this._logger.warn(`Fail request production mode due error: ${err.message}`);
                    }),
            ])
                .then(() => {
                    this._setup();
                    resolve();
                })
                .catch((err: Error) => {
                    this._logger.error(
                        `Fail correctly init service due error: ${err.message}. This is not blocking error, appliction will be started in anyway.`,
                    );
                    resolve();
                });
        });
    }

    public getName(): string {
        return 'LogsService';
    }

    public destroy() {
        // Drop callback to prevent addition IPC calls
        setGlobalLogCallback((msg: string) => {});
        // Unsubscribe
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
    }

    public isProduction(): boolean {
        return this._production;
    }

    private _setup() {
        setGlobalLogCallback(this._write.bind(this));
        setGlobalLogLevel(ELogLevels.DEBUG);
        this._logger.debug(`Production mode: ${this._production}`);
        setGlobalLogLevel(this._level);
    }

    private _write(msg: string, level: ELogLevels) {
        ElectronIpcService.send(
            new IPC.ChipmunkClientLog({
                msg: msg,
                level: level,
            }),
        ).catch((error: Error) => {
            /* tslint:disable */
            console.log(`Fail send logs via IPC due error: ${error.message}`);
            /* tslint:enable */
        });
    }
}

export default new LogsService();
