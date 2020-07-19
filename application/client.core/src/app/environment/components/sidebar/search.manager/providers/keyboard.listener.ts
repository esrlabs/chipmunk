export class KeyboardListener {

    private _ctrl: boolean = false;

    constructor() {
        this._keyup = this._keyup.bind(this);
        this._keydown = this._keydown.bind(this);
        window.addEventListener('keyup', this._keyup);
        window.addEventListener('keydown', this._keydown);
    }

    public destroy() {
        window.removeEventListener('keyup', this._keyup);
        window.removeEventListener('keydown', this._keydown);
    }

    public ctrl(): boolean {
        return this._ctrl;
    }

    private _keyup(event: KeyboardEvent) {
        this._ctrl = false;
    }

    private _keydown(event: KeyboardEvent) {
        this._ctrl = event.ctrlKey;
    }

}
