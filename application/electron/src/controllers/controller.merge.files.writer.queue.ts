import { EventEmitter } from 'events';

export default class Queue extends EventEmitter {

    public static Events = {
        done: 'done',
        finish: 'finish',
    };

    private _count: number = -1;
    private _done: number = -1;

    constructor() {
        super();
    }

    public destroy() {
        this.removeAllListeners();
    }

    public setCount(count: number) {
        this._count = count;
        this.drop();
    }

    public drop() {
        this._done = 0;
    }

    public done() {
        this._done += 1;
        if (this._done >= this._count) {
            this.emit(Queue.Events.done);
            this.drop();
        }
    }

    public finish() {
        this._count -= 1;
        if (this._count === 0) {
            this.emit(Queue.Events.finish);
        }
    }
}
