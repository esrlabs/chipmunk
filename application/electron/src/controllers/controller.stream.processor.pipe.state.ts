import ServiceElectron, { IPCMessages as IPCElectronMessages } from '../services/service.electron';
import Logger from '../tools/env.logger';

const CSettings = {
    notificationDelayOnStream: 250, // ms, Delay for sending notifications about stream's update to render (client) via IPC, when stream is blocked
};

interface IProgress {
    name: string;
    done: number;
    size: number;
    started: number;
}

export default class PipeState {

    private _streamId: string;
    private _tracks: Map<string, IProgress> = new Map();
    private _timer: any;
    private _last: number = 0;
    private _logger: Logger;

    constructor(streamId: string) {
        this._streamId = streamId;
        this._logger = new Logger(`PipeState: ${this._streamId}`);
    }

    public destroy() {
        clearTimeout(this._timer);
        this._tracks.clear();
        this._send();
    }

    public add(id: string, size: number, name: string) {
        if (this._tracks.has(id)) {
            return;
        }
        this._tracks.set(id, {
            name: name,
            started: Date.now(),
            size: size,
            done: 0,
        });
    }

    public remove(id: string) {
        const track: IProgress | undefined = this._tracks.get(id);
        if (track === undefined) {
            return;
        }
        this._logger.env(`All pipes done with task "${track.name}" in: ${((Date.now() - track.started) / 1000).toFixed(2)}s. Full size: ${(track.size / 1024 / 1024).toFixed(2)} Mb.`);
        this._tracks.delete(id);
        if (this._tracks.size === 0) {
            this._logger.env(`All tasks are done.`);
        }
        this._send();
    }

    public next(id: string, written: number) {
        const track: IProgress | undefined = this._tracks.get(id);
        if (track === undefined) {
            return;
        }
        track.done += written;
        if (track.done >= track.size) {
            this.remove(id);
        } else {
            this._tracks.set(id, track);
            this._notify();
        }
    }

    private _send() {
        clearTimeout(this._timer);
        this._last = Date.now();
        ServiceElectron.IPC.send(new IPCElectronMessages.StreamPipeState({
            streamId: this._streamId,
            tracks: Array.from(this._tracks.values()),
        }));
    }

    private _notify() {
        clearTimeout(this._timer);
        const past: number = Date.now() - this._last;
        if (past < CSettings.notificationDelayOnStream) {
            this._timer = setTimeout(() => {
                this._send();
            }, CSettings.notificationDelayOnStream - past);
            return;
        }
        this._send();
    }

}
