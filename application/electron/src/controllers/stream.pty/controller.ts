import * as pty from 'node-pty';
import * as os from 'os';

import ServiceElectron from '../../services/service.electron';
import ServiceStreamSources from '../../services/service.stream.sources';
import Logger from '../../tools/env.logger';
import ControllerStreamProcessor from '../stream.main/controller';
import ServiceRenderState from '../../services/service.render.state';

import { IPCMessages, Subscription } from '../../services/service.electron';

export default class ControllerStreamPty {

    private _logger: Logger;
    private _guid: string;
    private _pty: pty.IPty;
    private _subscriptions: { [key: string ]: Subscription | undefined } = { };
    private _streaming: boolean = false;
    private _processor: ControllerStreamProcessor;
    private _pending: string = '';
    private _process: {
        pid: number | undefined,    // This is PID of node-pty, but not of programm running in shell
        def: string | undefined,    // Title of shell. Basically it's shell promt
        ttl: string | undefined,    // Current title. Title of running programm.
        src: number,                // ID of sources
    } = {
        pid: undefined,
        def: undefined,
        ttl: undefined,
        src: 1000,
    };

    constructor(guid: string, stream: ControllerStreamProcessor) {
        this._guid = guid;
        this._processor = stream;
        this._logger = new Logger(`ControllerStreamPty: ${guid}`);
        this._pty = this._create();
        // Listen IPC messages
        ServiceElectron.IPC.subscribe(IPCMessages.StreamPtyInRequest, this._ipc_onStreamPtyInRequest.bind(this)).then((subscription: Subscription) => {
            this._subscriptions.StreamPtyInRequest = subscription;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to subscribe to event "StreamPtyInRequest" due error: ${error.message}.`);
        });
        ServiceElectron.IPC.subscribe(IPCMessages.StreamPtyStreamingRequest, this._ipc_onStreamPtyStreamingRequest.bind(this)).then((subscription: Subscription) => {
            this._subscriptions.StreamPtyStreamingRequest = subscription;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to subscribe to event "StreamPtyStreamingRequest" due error: ${error.message}.`);
        });
        ServiceElectron.IPC.subscribe(IPCMessages.StreamPtyPendingRequest, this._ipc_onStreamPtyPendingRequest.bind(this)).then((subscription: Subscription) => {
            this._subscriptions.StreamPtyPendingRequest = subscription;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to subscribe to event "StreamPtyPendingRequest" due error: ${error.message}.`);
        });
        ServiceElectron.IPC.subscribe(IPCMessages.StreamPtyResizeRequest, this._ipc_onStreamPtyResizeRequest.bind(this)).then((subscription: Subscription) => {
            this._subscriptions.StreamPtyResizeRequest = subscription;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to subscribe to event "StreamPtyResizeRequest" due error: ${error.message}.`);
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Unsubscribe IPC messages / events
            Object.keys(this._subscriptions).forEach((key: string) => {
                (this._subscriptions as any)[key].destroy();
            });
            // Destroy pty
            if (this._pty !== undefined) {
                this._pty.kill();
            }
            resolve();
        });
    }

    private _create(): pty.IPty {
        const shell = process.env[os.platform() === 'win32' ? 'COMSPEC' : 'SHELL'];
        const ptyChild = pty.spawn(shell as string, [], {
            name: 'xterm-256color',
            cols: 160,
            rows: 2,
            cwd: process.cwd(),
        });
        ptyChild.on('data', this._pty_onData.bind(this));
        return ptyChild;
    }

    private _pause() {
        // Do this "stupid" thing, because even methods pause/resume are documented,
        // it isn't a part of type declaration.
        if (typeof (this._pty as any).pause !== 'function') {
            return;
        }
        (this._pty as any).pause();
    }

    private _resume() {
        // Do this "stupid" thing, because even methods pause/resume are documented,
        // it isn't a part of type declaration.
        if (typeof (this._pty as any).resume !== 'function') {
            return;
        }
        (this._pty as any).resume();
    }

    private _updateTitleState() {
        if (this._process.def === undefined) {
            this._process.def = this._pty.process;
        }
        if (this._process.pid !== this._pty.pid) {
            this._process.pid = this._pty.pid;
        }
        if (this._process.ttl === undefined) {
            this._process.ttl = this._pty.process;
            return;
        }
        if (this._process.ttl === this._pty.process) {
            return;
        } else {
            this._logger.wtf(`>>>> ${this._pty.process}`);
        }
        this._process.ttl = this._pty.process;
    }

    private _getSourceId(): number {
        if (this._process.src === -1) {
            this._process.src = ServiceStreamSources.add({
                name: this._process.ttl as string,
                session: this._guid,
            });
        } else {
            const id: number | undefined = ServiceStreamSources.getIdByName(this._guid, this._process.ttl as string);
            if (id === undefined) {
                this._process.src = ServiceStreamSources.add({
                    name: this._process.ttl as string,
                    session: this._guid,
                });
            } else {
                this._process.src = id;
            }
        }
        return this._process.src;
    }

    private _pty_onData(data: string) {
        this._updateTitleState();
        this._pause();
        Promise.all([
            this._outToTerminal(data),
            this._outToStream(data),
        ]).catch((error: Error) => {
            this._logger.warn(`Fail to process terminal data due error: ${error.message}`);
        }).finally(() => {
            this._resume();
        });
    }

    private _outToTerminal(data: string): Promise<void> {
        return new Promise((resolve) => {
            if (!ServiceRenderState.ready()) {
                this._pending += data;
                return resolve();
            }
            ServiceElectron.IPC.request(new IPCMessages.StreamPtyOutRequest({
                guid: this._guid,
                data: this._pending + data,
            }), IPCMessages.StreamPtyOutResponse).then((response: IPCMessages.StreamPtyOutResponse) => {
                if (response.error !== undefined) {
                    this._logger.warn(`Error during writing into terminal: ${response.error}`);
                    this._pending += data;
                } else {
                    this._pending = '';
                }
            }).catch((err: Error) => {
                this._logger.warn(`Fail write to terminal due error: ${err.message}`);
                this._pending += data;
            }).finally(() => {
                resolve();
            });
        });
    }

    private _outToStream(data: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this._streaming || data.trim() === '') {
                return resolve();
            }
            this._processor.write(data, undefined, undefined, this._getSourceId()).then(resolve).catch(reject);
        });
    }

    private _ipc_onStreamPtyInRequest(message: IPCMessages.TMessage, response: (instance: any) => Promise<void>) {
        const request: IPCMessages.StreamPtyInRequest = message as IPCMessages.StreamPtyInRequest;
        if (request.guid !== this._guid) {
            return;
        }
        this._pty.write(request.data);
        response(new IPCMessages.StreamPtyInResponse({ })).catch((err: Error) => {
            this._logger.warn(`Fail send response (StreamPtyInResponse) due error: ${err.message}`);
        });
    }

    private _ipc_onStreamPtyStreamingRequest(message: IPCMessages.TMessage, response: (instance: any) => Promise<void>) {
        const request: IPCMessages.StreamPtyStreamingRequest = message as IPCMessages.StreamPtyStreamingRequest;
        if (request.guid !== this._guid) {
            return;
        }
        this._streaming = request.streaming;
        response(new IPCMessages.StreamPtyStreamingResponse({ })).catch((err: Error) => {
            this._logger.warn(`Fail send response (StreamPtyStreamingResponse) due error: ${err.message}`);
        });
    }

    private _ipc_onStreamPtyPendingRequest(message: IPCMessages.TMessage, response: (instance: any) => Promise<void>) {
        const request: IPCMessages.StreamPtyPendingRequest = message as IPCMessages.StreamPtyPendingRequest;
        if (request.guid !== this._guid) {
            return;
        }
        response(new IPCMessages.StreamPtyPendingResponse({
            pending: this._pending,
        })).catch((err: Error) => {
            this._logger.warn(`Fail send response (StreamPtyPendingResponse) due error: ${err.message}`);
        });
    }

    private _ipc_onStreamPtyResizeRequest(message: IPCMessages.TMessage, response: (instance: any) => Promise<void>) {
        const request: IPCMessages.StreamPtyResizeRequest = message as IPCMessages.StreamPtyResizeRequest;
        if (request.guid !== this._guid) {
            return;
        }
        this._pty.resize(request.col, request.row);
        response(new IPCMessages.StreamPtyResizeResponse({})).catch((err: Error) => {
            this._logger.warn(`Fail send response (StreamPtyResizeResponse) due error: ${err.message}`);
        });
    }

}
