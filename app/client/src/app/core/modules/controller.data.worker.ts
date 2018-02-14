import {IWorkerRequest, IWorkerResponse, WORKER_COMMANDS} from '../../workers/data.processor.interfaces';
import { events as Events                               } from "./controller.events";
import { configuration as Configuration                 } from "./controller.config";
import { Logs, TYPES as LogTypes                        } from './tools.logs.js';

interface IWorkerCallback {
    resolve: Function,
    reject: Function
}

export class WorkerController {

    private _worker     : Worker                            = new Worker('./app/workers/data.processor.loader.js');
    private _sequenceID : number                            = 0;
    private _callbacks  : { [key: string]: IWorkerCallback} = { };
    private _ready      : boolean                           = false;

    public COMMANDS = WORKER_COMMANDS;

    constructor(){
        this._worker.addEventListener('message', this._onWorkerMessage.bind(this));
    }

    private _getCallback(sequenceID: number): IWorkerCallback | null {
        const callback = this._callbacks[sequenceID] === void 0 ? null : this._callbacks[sequenceID];
        this._removeCallback(sequenceID);
        return callback;
    }

    private _addCallback(sequenceID: number, resolve: Function, reject: Function ) {
        this._updateProgressBar();
        this._callbacks[sequenceID] = {
            resolve: resolve,
            reject: reject
        };
    }

    private _removeCallback(sequenceID: number) {
        delete this._callbacks[sequenceID];
    }

    private _onReady(response: IWorkerResponse){
        if (response.message === 'ready') {
            this._ready = true;
        }
    }

    private _onWorkerMessage(event: MessageEvent) {
        const response = event.data as IWorkerResponse;
        const sequenceID = response.sequenceID;
        const callback = this._getCallback(sequenceID);
        this._onReady(response);
        if (callback === null) {
            return Logs.msg(`Worker response without bound callback, sequenceID=${sequenceID}.`, LogTypes.WARNING);
        }
        callback.resolve(response);
        this._updateProgressBar();
    }

    private _updateProgressBar(){
        if (Object.keys(this._callbacks).length === 0) {
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.GLOBAL_PROGRESS_HIDE);
        } else {
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.GLOBAL_PROGRESS_SHOW);
        }
    }

    public post(message: IWorkerRequest): Promise<IWorkerResponse> {
        if (!this._ready) {
            return Promise.reject(new Error(`Worker isn't ready yet`));
        }
        message.sequenceID = this._sequenceID++;
        return new Promise<IWorkerResponse> ((resolve, reject) => {
            this._addCallback(message.sequenceID, resolve, reject);
            this._worker.postMessage(message);
        });
    }

}