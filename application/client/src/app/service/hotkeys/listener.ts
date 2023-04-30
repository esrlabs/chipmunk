import { KeyDescription, Requirement } from '@platform/types/hotkeys/map';
import { Emitter } from './emitter';
import { Subject } from '@platform/env/subscription';
import { env } from '@service/env';

export class Listener {
    static CONCLUSION_TIMEOUT = 200;

    public subject: Subject<string> = new Subject();

    protected readonly emitters: Map<string, Emitter> = new Map();
    protected readonly iteration: {
        timer: unknown;
        emitted: string[];
    } = {
        timer: undefined,
        emitted: [],
    };
    protected requirements: Requirement[] = [];

    constructor(descs: KeyDescription[]) {
        descs.forEach((desc: KeyDescription) => {
            this.emitters.set(desc.uuid, new Emitter(desc.uuid, desc.client, desc.required));
        });
    }

    public destroy(): void {
        this.iteration.timer !== undefined && clearTimeout(this.iteration.timer as number);
        this.emitters.forEach((emitter: Emitter) => {
            emitter.destroy();
        });
    }

    public emit(event: KeyboardEvent | string): boolean {
        let postponed = false;
        if (typeof event === 'string') {
            const emitter = this.emitters.get(event);
            if (emitter === undefined) {
                return false;
            }
            this.iteration.emitted.indexOf(emitter.uuid()) === -1 &&
                this.iteration.emitted.push(emitter.uuid());
        } else {
            if (this.iteration.timer === undefined) {
                this.iteration.emitted = [];
                this.iteration.timer = setTimeout(() => {
                    this._accept();
                }, Listener.CONCLUSION_TIMEOUT);
            }
            this.emitters.forEach((emitter: Emitter) => {
                if (!emitter.isTracking() || !emitter.allowed(this.requirements)) {
                    return;
                }
                if (
                    emitter
                        .ctrl(env.platform().darwin() ? event.metaKey : event.ctrlKey)
                        .alt(event.altKey)
                        .shift(event.shiftKey)
                        .key(event.key)
                        .emitted()
                ) {
                    this.iteration.emitted.indexOf(emitter.uuid()) === -1 &&
                        this.iteration.emitted.push(emitter.uuid());
                    postponed = emitter.postponed();
                }
            });
        }
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
                if (this.requirements.includes(requirement)) {
                    return;
                }
                this.requirements.push(requirement);
            },
            deactivate: (): void => {
                this.requirements = this.requirements.filter((r) => r !== requirement);
            },
        };
    }

    private _accept(): boolean {
        const emitted = this.iteration.emitted;
        this.iteration.timer !== undefined && clearTimeout(this.iteration.timer as number);
        this.iteration.timer = undefined;
        this.iteration.emitted = [];
        if (emitted.length === 0) {
            return true;
        }
        this.subject.emit(emitted[emitted.length - 1]);
        return false;
    }
}
