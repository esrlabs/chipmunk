export class Queue {
    private _tasks: Array<() => void> = [];
    private _locked: boolean = true;

    public do(callback: () => void) {
        if (this._locked) {
            this._tasks.push(callback);
        } else {
            callback();
        }
    }

    public unlock() {
        this._tasks.forEach((callback: () => void) => {
            callback();
        });
        this._tasks = [];
        this._locked = false;
    }
}
