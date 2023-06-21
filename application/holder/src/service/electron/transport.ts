/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    Transport,
    ISignatureRequirement,
    EntityConstructor,
    Package,
    Packed,
    Respond,
    Errors,
} from 'platform/ipc/transport';
import { Subject, Subscription } from 'platform/env/subscription';
import { ipcMain, IpcMainEvent, BrowserWindow } from 'electron';
import { Logger } from '@env/logs/index';
import { error } from 'platform/log/utils';

import * as events from 'platform/ipc/setup/channels';

interface IEventDesc {
    subject: Subject<any>;
    ref: EntityConstructor<any> & ISignatureRequirement;
}

interface PendingEntity {
    resolver: (...args: any[]) => void;
    rejector: (error: Error | Errors.RustNativeError) => void;
    ref: EntityConstructor<any> & ISignatureRequirement;
}

export class Implementation extends Transport {
    private _subjects: Map<string, IEventDesc> = new Map();
    private _log: Logger = new Logger('ElectronAPITransport');
    private _sequence = 0;
    private _requests: Map<number, PendingEntity> = new Map();
    private _window: BrowserWindow;
    private _respondents: Map<
        string,
        {
            owner: string;
            respond: Respond<any, any>;
            ref: EntityConstructor<any> & ISignatureRequirement;
        }
    > = new Map();
    private _destroyed = false;

    constructor(window: BrowserWindow) {
        super();
        this._window = window;
        this._onRenderEvent = this._onRenderEvent.bind(this);
        this._onRenderRequest = this._onRenderRequest.bind(this);
        this._onRenderResponse = this._onRenderResponse.bind(this);
        ipcMain.on(events.RENDER_EVENT_NAME, this._onRenderEvent);
        ipcMain.on(events.RENDER_REQUEST_NAME, this._onRenderRequest);
        ipcMain.on(events.RENDER_RESPONSE_NAME, this._onRenderResponse);
    }

    public destroy(): void {
        ipcMain.removeAllListeners();
        this._requests.forEach((request) => {
            request.rejector(new Error(`Rejected because transport is destroying`));
        });
        this._requests.clear();
        this._respondents.clear();
        this._destroyed = true;
    }

    public request<Request, Response>(
        request: Request & ISignatureRequirement,
        responseConstructorRef: EntityConstructor<Response> & ISignatureRequirement,
    ): Promise<Response> {
        if (this._destroyed) {
            return Promise.reject(new Error(`Transport is destroyed`));
        }
        return new Promise((resolve, reject) => {
            const pack = new Package(this._getSequence()).payload(request);
            this._requests.set(pack.getSequence(), {
                resolver: resolve,
                rejector: reject,
                ref: responseConstructorRef,
            });
            try {
                this._window.webContents.send(events.HOST_REQUEST_NAME, pack.packed());
            } catch (e) {
                this._log.error(`Fail to parse message: ${error(e)}`);
                this._log.error(`begin:`);
                this._log.error(JSON.stringify(pack.packed()));
                this._log.error(`:end`);
            }
            // TODO: add timeout
        });
    }

    public respondent<Request, Response>(
        owner: string,
        request: EntityConstructor<Request> & ISignatureRequirement,
        respond: Respond<Request, Response>,
    ): Subscription {
        const signature: string = request.getSignature();
        const respondent = this._respondents.get(signature);
        if (respondent !== undefined) {
            throw new Error(
                `Respondent has been setup already for "${signature}". Owner: ${respondent.owner}`,
            );
        }
        this._respondents.set(signature, {
            owner,
            ref: request,
            respond,
        });
        return new Subscription(`${owner}:${signature}`, () => {
            this._respondents.delete(signature);
        });
    }

    public notify<Notification>(notification: Notification & ISignatureRequirement): void {
        if (this._destroyed) {
            return;
        }
        this._window.webContents.send(
            events.HOST_EVENT_NAME,
            new Package(this._getSequence()).payload(notification).packed(),
        );
    }

    public subscribe<Event>(
        event: string,
        refEventConstructor: EntityConstructor<Event> & ISignatureRequirement,
    ): Subject<typeof refEventConstructor> {
        if (typeof event !== 'string' || event.trim() === '') {
            throw new Error(`Event name should be a not-empty string`);
        }
        let desc: IEventDesc | undefined = this._subjects.get(event);
        if (desc === undefined) {
            desc = {
                subject: new Subject<typeof refEventConstructor>(),
                ref: refEventConstructor,
            };
            this._subjects.set(event, desc);
        }
        return desc.subject;
    }

    public emulate<Entity>(entity: Entity & ISignatureRequirement): {
        event(): void;
        request(): void;
        response(sequence: number): void;
    } {
        return {
            event: () => {
                this._window.webContents.send(
                    events.RENDER_EVENT_NAME,
                    new Package(this._getSequence()).payload(entity).packed(),
                );
            },
            request: () => {
                this._window.webContents.send(
                    events.RENDER_REQUEST_NAME,
                    new Package(this._getSequence()).payload(entity).packed(),
                );
            },
            response: (sequence: number) => {
                this._window.webContents.send(
                    events.RENDER_RESPONSE_NAME,
                    new Package(sequence).payload(entity).packed(),
                );
            },
        };
    }

    private _getSequence(): number {
        return this._sequence++;
    }

    private _onRenderEvent(_event: IpcMainEvent, message: Packed) {
        const pack = Package.from(message);
        if (pack instanceof Error) {
            this._log.error(`Fail to parse income event: ${pack.message}`);
            return;
        }
        const signature = pack.getSignature();
        if (signature instanceof Error) {
            this._log.error(`Has been gotten event, but signature cannot be detected`);
            return;
        }
        const desc: IEventDesc | undefined = this._subjects.get(signature);
        if (desc === undefined) {
            this._log.warn(`Event ${signature} has been gotten, but no subscribers has been found`);
            return;
        }
        const payload = pack.getPayload(desc.ref);
        if (payload instanceof Error) {
            this._log.error(`Error with processing event "${signature}": ${payload.message}`);
            return;
        }
        this._log.verbose(`Event ${signature} has been gotten and successfully constructed.`);
        desc.subject.emit(payload);
    }

    private _onRenderRequest(_event: IpcMainEvent, message: Packed) {
        const pack = Package.from(message);
        if (pack instanceof Error) {
            this._log.error(`Fail to parse income event: ${pack.message}`);
            return;
        }
        const signature = pack.getSignature();
        if (signature instanceof Error) {
            this._log.error(`Has been gotten event, but signature cannot be detected`);
            return;
        }
        const respondent = this._respondents.get(signature);
        if (respondent === undefined) {
            this._log.error(`No respondent for "${signature}" has been setup`);
            return;
        }
        const payload = pack.getPayload(respondent.ref);
        if (payload instanceof Error) {
            this._log.error(
                `Error with processing host request "${signature}": ${payload.message}`,
            );
            return;
        }
        this._log.verbose(
            `Request ${signature} (seq: ${pack.getSequence()}) has been gotten and successfully constructed.`,
        );
        respondent
            .respond(payload)
            .then((response: ISignatureRequirement) => {
                this._window.webContents.send(
                    events.HOST_RESPONSE_NAME,
                    new Package(pack.getSequence()).payload(response).packed(),
                );
            })
            .canceled(() => {
                this._window.webContents.send(
                    events.HOST_RESPONSE_NAME,
                    new Package(pack.getSequence()).abort().packed(),
                );
            })
            .catch((err: Error) => {
                this._window.webContents.send(
                    events.HOST_RESPONSE_NAME,
                    new Package(pack.getSequence()).error(error(err)).packed(),
                );
            });
    }

    private _onRenderResponse(_event: unknown, message: Packed) {
        const pack = Package.from(message);
        if (pack instanceof Error) {
            this._log.error(`Fail to parse income event: ${pack.message}`);
            return;
        }
        const desc = this._requests.get(pack.getSequence());
        const signature = pack.getSignature();
        if (desc === undefined) {
            this._log.warn(
                `Has been gotten response "${
                    signature instanceof Error ? 'unknown' : signature
                }"; sequence: ${pack.getSequence()}. But pending entity isn't found.`,
            );
            return;
        }
        this._requests.delete(pack.getSequence());
        const error = pack.getError();
        if (error !== undefined) {
            desc.rejector(error);
            return;
        }
        if (signature instanceof Error) {
            this._log.error(`Has been gotten response, but signature cannot be detected`);
            return;
        }
        const payload = pack.getPayload(desc.ref);
        if (payload instanceof Error) {
            desc.rejector(payload);
            return;
        }
        desc.resolver(payload);
    }
}
