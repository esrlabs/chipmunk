import { Package, Packed } from '@platform/ipc/transport/index';
import { unique } from '@platform/env/sequence';
import { IGrabbedElement } from '@platform/types/content';

import * as Requests from '@platform/ipc/request';
import * as Events from '@platform/ipc/event';

class EmulatedSession {
    public readonly file: string = `emulated:${unique().substring(0, 6)}.text`;
    public readonly len: number = Math.round(Math.random() * 10000000 + 10000);
    public readonly uuid: string;

    constructor(uuid: string) {
        this.uuid = uuid;
    }

    public openFile() {
        setTimeout(() => {
            Events.IpcEvent.emulate(
                new Events.Stream.Updated.Event({
                    session: this.uuid,
                    rows: this.len,
                }),
            );
        }, 250);
    }
}
class EmulatedSessions {
    private _sessions: Map<string, EmulatedSession> = new Map();

    public add(): string {
        const uuid = unique();
        this._sessions.set(uuid, new EmulatedSession(uuid));
        return uuid;
    }

    public getSession(uuid: string): EmulatedSession | undefined {
        return this._sessions.get(uuid);
    }
}

const sessions = new EmulatedSessions();

export function processOutgoingRequest(packed: Packed) {
    const packaged = Package.from(packed);
    if (packaged instanceof Error) {
        throw packaged;
    }
    const signature = packaged.getSignature();
    if (signature instanceof Error) {
        throw signature;
    }
    switch (signature) {
        case 'SessionCreateRequest':
            SessionCreateRequest(packaged as Package<Requests.Session.Create.Request>);
            break;
        case 'OpenFileRequest':
            OpenFileRequest(packaged as Package<Requests.File.Open.Request>);
            break;
        case 'StreamChunkRequest':
            StreamChunkRequest(packaged as Package<Requests.Stream.Chunk.Request>);
            break;
    }
}

function SessionCreateRequest(packaged: Package<Requests.Session.Create.Request>) {
    const request = packaged.getPayload(Requests.Session.Create.Request);
    if (request instanceof Error) {
        throw request;
    }
    Requests.IpcRequest.emulate(
        new Requests.Session.Create.Response({
            uuid: sessions.add(),
        }),
    ).response(packaged.getSequence());
}

function OpenFileRequest(packaged: Package<Requests.File.Open.Request>) {
    const request = packaged.getPayload(Requests.File.Open.Request);
    if (request instanceof Error) {
        throw request;
    }
    const parsed = new Requests.File.Open.Request(request);
    const session = sessions.getSession(parsed.session);
    if (session === undefined) {
        throw new Error(`Cannot find session ${parsed.session}`);
    }
    session.openFile();
    Requests.IpcRequest.emulate(
        new Requests.File.Open.Response({
            session: parsed.session,
        }),
    ).response(packaged.getSequence());
}

function StreamChunkRequest(packaged: Package<Requests.Stream.Chunk.Request>) {
    const request = packaged.getPayload(Requests.Stream.Chunk.Request);
    if (request instanceof Error) {
        throw request;
    }
    const parsed = new Requests.Stream.Chunk.Request(request);
    const session = sessions.getSession(parsed.session);
    if (session === undefined) {
        throw new Error(`Cannot find session ${parsed.session}`);
    }
    const rows: IGrabbedElement[] = [];
    for (let i = request.from; i < request.to; i += 1) {
        rows.push({
            content: `___${i}___`.repeat(20),
            source_id: 0,
            position: i,
            nature: [0],
        });
    }
    Requests.IpcRequest.emulate(
        new Requests.Stream.Chunk.Response({
            session: parsed.session,
            rows,
            from: request.from,
            to: request.to,
        }),
    ).response(packaged.getSequence());
}
