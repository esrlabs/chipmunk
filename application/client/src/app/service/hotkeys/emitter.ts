import { Binding, Requirement } from './map';

export class Emitter {
    static TIMEOUT = 250;

    private _ctrl: boolean = false;
    private _shift: boolean = false;
    private _alt: boolean = false;
    private _key: boolean = false;
    private _collected: string = '';
    private _target: string = '';
    private _timeout: unknown;
    private readonly _binding: Binding;
    private readonly _uuid: string;
    private readonly _requirements: Requirement[];

    constructor(uuid: string, binding: Binding, requirements: Requirement[]) {
        this._uuid = uuid;
        this._binding = binding;
        this._requirements = requirements;
        this._target =
            this._binding.key instanceof Array
                ? this._binding.key.map((k) => k.toLowerCase()).join('')
                : this._binding.key.toLowerCase();
    }

    public destroy() {
        this._timeout !== undefined && clearTimeout(this._timeout as number);
    }

    public ctrl(value: boolean): Emitter {
        this._ctrl = this._binding.ctrl === true ? value : true;
        return this;
    }

    public shift(value: boolean): Emitter {
        this._shift = this._binding.shift === true ? value : true;
        return this;
    }

    public alt(value: boolean): Emitter {
        this._alt = this._binding.alt === true ? value : true;
        return this;
    }

    public key(key: string): Emitter {
        this._collected += key.toLowerCase();
        this._key = this._collected === this._target;
        return this;
    }

    public emitted(): boolean {
        const emitted = this._alt && this._ctrl && this._shift && this._key;
        if (this.isCollectable() && !emitted) {
            this._timeout = setTimeout(() => {
                this.drop();
            }, Emitter.TIMEOUT);
        } else {
            this.drop();
        }
        return emitted;
    }

    public postponed(): boolean {
        return this._binding.postponed === true ? true : false;
    }

    public uuid(): string {
        return this._uuid;
    }

    public allowed(requirements: Requirement[]): boolean {
        let allowed = true;
        this._requirements.forEach((req) => {
            allowed = !allowed ? false : requirements.includes(req);
        });
        return allowed;
    }

    protected drop(): Emitter {
        this._alt = false;
        this._ctrl = false;
        this._shift = false;
        this._key = false;
        this._collected = '';
        this._timeout = undefined;
        return this;
    }

    protected isCollectable(): boolean {
        return this._binding.key instanceof Array;
    }
}
