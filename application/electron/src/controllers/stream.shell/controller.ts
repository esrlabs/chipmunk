import { IPCMessages as IPC, Subscription } from '../../services/service.electron';
import { ChildProcess, spawn } from 'child_process';

import ServiceElectron from '../../services/service.electron';

import Logger from '../../tools/env.logger';

import * as Tools from '../../tools/index';

export interface IProcessStat {
    recieved: number;
    created: number;
    pid: number;
}

export interface IProcessMeta {
    sourceId: number;
    color: string;
}

export interface IProcess {
    guid: string;
    command: string;
    pwd: string;
    stat: IProcessStat;
    meta: IProcessMeta;
}

interface IRunningProcess {
    info: IProcess;
    instance: ChildProcess;
}

export default class ControllerStreamShell {

    private _logger: Logger;
    private _guid: string;
    private _running: Map<string, IRunningProcess> = new Map();

    constructor(guid: string) {
        this._guid = guid;
        this._logger = new Logger(`ControllerStreamSearch: ${guid}`);
    }

    public destroy(): Promise<void> {
        return Promise.resolve();
    }


}