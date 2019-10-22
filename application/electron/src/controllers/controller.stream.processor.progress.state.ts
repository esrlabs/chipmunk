import ServiceElectron, { IPCMessages as IPCElectronMessages } from '../services/service.electron';
import Logger from '../tools/env.logger';

const CSettings = {
    notificationDelayOnStream: 500,             // ms, Delay for sending notifications about stream's update to render (client) via IPC, when stream is blocked
    maxPostponedNotificationMessages: 500,      // How many IPC messages to render (client) should be postponed via timer
};

interface IProgress {
    name: string;
    progress: number;
    started: number;
}

export default class ProgressState {

    private _streamId: string;
    private _tracks: Map<string, IProgress> = new Map();
    private _timer: any;
    private _postponed: number = 0;
    private _logger: Logger;

    constructor(streamId: string) {
        this._streamId = streamId;
        this._logger = new Logger(`ProgressState: ${this._streamId}`);
    }

    public destroy() {
        clearTimeout(this._timer);
        this._tracks.clear();
        this._send();
    }

    public add(id: string, name: string) {
        if (this._tracks.has(id)) {
            return;
        }
        this._tracks.set(id, {
            name: name,
            progress: -1,
            started: Date.now(),
        });
    }

    public remove(id: string) {
        const track: IProgress | undefined = this._tracks.get(id);
        if (track === undefined) {
            return;
        }
        this._logger.env(`Task "${track.name}" done in: ${((Date.now() - track.started) / 1000).toFixed(2)}s`);
        this._tracks.delete(id);
        if (this._tracks.size === 0) {
            this._logger.env(`No states.`);
        }
        this._send();
    }

    public next(id: string, progress: number) {
        const track: IProgress | undefined = this._tracks.get(id);
        if (track === undefined) {
            return;
        }
        if (track.progress === progress) {
            return;
        }
        if (progress < 0 || progress > 1) {
            return;
        }
        track.progress = progress;
        this._tracks.set(id, track);
        this._notify();
    }

    private _send() {
        clearTimeout(this._timer);
        ServiceElectron.IPC.send(new IPCElectronMessages.StreamProgressState({
            streamId: this._streamId,
            tracks: Array.from(this._tracks.values()),
        }));
    }

    private _notify() {
        clearTimeout(this._timer);
        if (this._postponed < CSettings.maxPostponedNotificationMessages) {
            this._postponed += 1;
            this._timer = setTimeout(() => {
                this._send();
            }, CSettings.notificationDelayOnStream);
        } else {
            this._postponed = 0;
            this._send();
        }
    }

}
