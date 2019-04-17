import ServiceElectron, { IPCMessages as IPCElectronMessages, Subscription } from '../services/service.electron';

export default class PipesState {

    private _streamId: string;
    private _names: Map<string, string> = new Map();
    private _size: number = 0;
    private _done: number = 0;

    constructor(streamId: string) {
        this._streamId = streamId;
    }

    public add(id: string, size: number, name: string) {
        if (this._names.has(id)) {
            return;
        }
        this._names.set(id, name);
        this._size += size;
    }

    public remove(id: string) {
        const pipe = this._names.get(id);
        if (pipe === undefined) {
            return;
        }
        this._names.delete(id);
        if (this._names.size === 0) {
            this._size = -1;
            this._done = -1;
        }
        this._send();
    }

    public next(written: number) {
        if (this._names.size === 0) {
            return;
        }
        this._done += written;
        this._send();
    }

    private _send() {
        ServiceElectron.IPC.send(new IPCElectronMessages.StreamPipeState({
            streamId: this._streamId,
            size: this._size,
            done: this._done,
            items: Array.from(this._names.values()),
        }));
    }
}
