export class Lock {
    private _locked: boolean = false;

    constructor(locked: boolean = false) {
        this._locked = locked;
    }

    public lock() {
        this._locked = true;
    }

    public unlock() {
        this._locked = false;
    }

    public isLocked(): boolean {
        return this._locked;
    }
}
