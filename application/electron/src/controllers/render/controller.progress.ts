import ServiceElectron, { IPCMessages as IPCElectronMessages } from '../../services/service.electron';
import Logger from '../../tools/env.logger';

const CSettings = {
    notificationDelayOnStream: 500, // ms, Delay for sending notifications about stream's update to render (client) via IPC, when stream is blocked
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
    private _last: number = 0;
    private _logger: Logger;

    constructor(streamId: string) {
        this._streamId = streamId;
        this._logger = new Logger(`ProgressState: ${this._streamId}`);
    }

    public destroy() {
        clearTimeout(this._timer);
        this._tracks.clear();
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
        this._logger.verbose(`Task "${track.name}" done in: ${((Date.now() - track.started) / 1000).toFixed(2)}s`);
        this._tracks.delete(id);
        if (this._tracks.size === 0) {
            this._logger.verbose(`No states.`);
        }
        this._notify();
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

    private _notify() {
        clearTimeout(this._timer);
        const past: number = Date.now() - this._last;
        if (past < CSettings.notificationDelayOnStream) {
            this._timer = setTimeout(() => {
                ServiceElectron.IPC.send(new IPCElectronMessages.StreamProgressState({
                    streamId: this._streamId,
                    tracks: Array.from(this._tracks.values()),
                })).catch((error: Error) => {
                    this._logger.warn(`Fail to send StreamProgressState due error: ${error.message}`);
                });
            }, CSettings.notificationDelayOnStream - past);
            return;
        }
    }

}
