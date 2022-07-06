import { KeyDescription, Requirement } from './map';
import { Emitter } from './emitter';
import { Subject } from '@platform/env/subscription';

export class Listener {
    static CONCLUSION_TIMEOUT = 300;

    public subject: Subject<string> = new Subject();

    private readonly emitters: Map<string, Emitter> = new Map();
    private _iteration: {
        timer: unknown;
        emitted: string[];
    } = {
        timer: undefined,
        emitted: [],
    };
    private _requirements: Requirement[] = [];

    constructor(descs: KeyDescription[]) {
        descs.forEach((desc: KeyDescription) => {
            this.emitters.set(desc.uuid, new Emitter(desc.uuid, desc.binding, desc.required));
        });
    }

    public destroy(): void {
        this._iteration.timer !== undefined && clearTimeout(this._iteration.timer as number);
        this.emitters.forEach((emitter: Emitter) => {
            emitter.destroy();
        });
    }

    public emit(event: KeyboardEvent): boolean {
        if (this._iteration.timer === undefined) {
            this._iteration.emitted = [];
            this._iteration.timer = setTimeout(() => {
                this._accept();
            }, Listener.CONCLUSION_TIMEOUT);
        }
        let postponed = false;
        this.emitters.forEach((emitter: Emitter) => {
            if (!emitter.allowed(this._requirements)) {
                return;
            }
            if (
                emitter
                    .ctrl(event.ctrlKey)
                    .alt(event.altKey)
                    .shift(event.shiftKey)
                    .key(event.key)
                    .emitted()
            ) {
                this._iteration.emitted.indexOf(emitter.uuid()) === -1 &&
                    this._iteration.emitted.push(emitter.uuid());
                postponed = emitter.postponed();
            }
        });
        if (!postponed) {
            return this._accept();
        } else {
            return true;
        }
    }

    public requirement(requirement: Requirement): {
        activate(): void;
        deactivate(): void;
    } {
        return {
            activate: (): void => {
                if (this._requirements.includes(requirement)) {
                    return;
                }
                this._requirements.push(requirement);
            },
            deactivate: (): void => {
                this._requirements = this._requirements.filter((r) => r !== requirement);
            },
        };
    }

    private _accept(): boolean {
        const emitted = this._iteration.emitted;
        this._iteration.timer !== undefined && clearTimeout(this._iteration.timer as number);
        this._iteration.timer = undefined;
        this._iteration.emitted = [];
        if (emitted.length === 0) {
            return true;
        }
        this.subject.emit(emitted[emitted.length - 1]);
        return false;
    }
}
