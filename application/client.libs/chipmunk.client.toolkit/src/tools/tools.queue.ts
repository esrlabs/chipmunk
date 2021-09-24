import Emitter from './tools.emitter';

export default class Queue extends Emitter {
    public static Events = {
        next: 'next',
        done: 'done',
    };

    private _tasks: Array<(...args: any[]) => any> = [];
    private _busy: boolean = false;
    private _done: number = 0;
    private _count: number = 0;
    private _delay: number;
    private _logger: (...args: any[]) => any;

    constructor(logger: (...args: any[]) => any, delay: number = 50) {
        super();
        this._logger = logger;
        this._delay = delay;
    }

    public add(task: (...args: any[]) => any) {
        this._tasks.push(task);
        this._count += 1;
        this._next();
    }

    private _next() {
        if (this._tasks.length === 0) {
            this._done = 0;
            this._count = 0;
            this.emit(Queue.Events.done);
            return;
        }
        if (this._busy) {
            return;
        }
        this._busy = true;
        const task = this._tasks.splice(0, 1)[0];
        setTimeout(() => {
            try {
                task();
            } catch (err) {
                this._logger(
                    `Task in queue was finished with error: ${
                        err instanceof Error ? err.message : err
                    }`,
                );
            } finally {
                this._done += 1;
            }
            this._busy = false;
            this.emit(Queue.Events.next, this._done, this._count);
            this._next();
        }, this._delay);
    }
}
