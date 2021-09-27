export class KeyboardListener {
    private _ctrl: boolean = false;
    private _shift: boolean = false;

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

    public shift(): boolean {
        return this._shift;
    }

    public ignore_ctrl_shift() {
        this._shift = false;
        this._ctrl = false;
    }

    private _keyup(event: KeyboardEvent) {
        this._ctrl = false;
        this._shift = false;
    }

    private _keydown(event: KeyboardEvent) {
        if (event.shiftKey) {
            this._shift = true;
            return;
        }
        if (['MetaLeft', 'MetaRight'].indexOf(event.code) !== -1) {
            // OSX
            this._ctrl = true;
        } else {
            // Others
            this._ctrl = event.ctrlKey;
        }
    }
}
