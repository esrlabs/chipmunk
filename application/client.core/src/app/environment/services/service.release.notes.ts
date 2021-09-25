import { Observable, Subject, Subscription } from 'rxjs';
import { IService } from '../interfaces/interface.service';
import { IPC } from './service.electron.ipc';

import ElectronIpcService from './service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IReleaseInfo {
    notes: string;
    version: string;
}

export class ReleaseNotesService implements IService {
    private readonly _url: string = 'https://api.github.com/repos/esrlabs/chipmunk/releases/tags/';

    private _logger: Toolkit.Logger = new Toolkit.Logger('ReleaseNotesService');
    private _info: IReleaseInfo | undefined;
    private _version: string = '';
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = {};
    private _subjects: {
        tab: Subject<void>;
    } = {
        tab: new Subject(),
    };

    constructor() {
        this._subscriptions.TabCustomRelease = ElectronIpcService.subscribe(
            IPC.TabCustomRelease,
            this._onTabCustomRelease.bind(this),
        );
        this._subscriptions.TabCustomVersion = ElectronIpcService.subscribe(
            IPC.TabCustomVersion,
            this._onTabCustomVersion.bind(this),
        );
    }

    public init(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'ReleaseNotesService';
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        return Promise.resolve();
    }

    public getObservable(): {
        tab: Observable<void>;
    } {
        return {
            tab: this._subjects.tab.asObservable(),
        };
    }

    public get(): Promise<IReleaseInfo> {
        return new Promise((resolve, reject) => {
            if (this._info !== undefined) {
                return resolve(this._info);
            }
            if (this._version === '') {
                return reject(new Error(this._logger.warn(`Chipmunk version not found`)));
            }
            fetch(this._url + this._version)
                .then((response: Response) => {
                    response
                        .json()
                        .then((value: any) => {
                            this._info = {
                                version: value.name,
                                notes: value.body,
                            };
                            resolve(this._info);
                        })
                        .catch((err: Error) => {
                            reject(
                                new Error(
                                    this._logger.warn(
                                        `Fail to parse release notes due error: ${err.message}`,
                                    ),
                                ),
                            );
                        });
                })
                .catch((err: Error) => {
                    reject(
                        new Error(
                            this._logger.warn(
                                `Fail to get release notes due error: ${err.message}`,
                            ),
                        ),
                    );
                });
        });
    }

    private _onTabCustomRelease() {
        this.get()
            .then(() => {
                this._subjects.tab.next();
            })
            .catch((err: Error) => {
                this._logger.warn(`Fail to call releases notes tab`);
            });
    }

    private _onTabCustomVersion(params: IPC.IVersion) {
        this._version = params.version;
    }
}

export default new ReleaseNotesService();
