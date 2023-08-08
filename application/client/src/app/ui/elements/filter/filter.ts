import { IlcInterface } from '@service/ilc';
import { Subject, Subjects } from '@platform/env/subscription';

export type Handler = () => void;

export interface Options {
    clearOnEscape?: boolean;
    clearOnEnter?: boolean;
    placeholder: string;
}

export class Filter {
    public readonly options: Options;
    public readonly subjects: Subjects<{
        change: Subject<string>;
        drop: Subject<void>;
        enter: Subject<string>;
        focus: Subject<void>;
        blur: Subject<void>;
        up: Subject<void>;
        down: Subject<void>;
    }> = new Subjects({
        change: new Subject<string>(),
        drop: new Subject<void>(),
        enter: new Subject<string>(),
        focus: new Subject<void>(),
        blur: new Subject<void>(),
        up: new Subject<void>(),
        down: new Subject<void>(),
    });
    private _element!: HTMLInputElement | undefined;

    constructor(ilc: IlcInterface, options: Options) {
        ilc.life().destroy(() => {
            this.subjects.destroy();
        });
        this.options = options;
    }

    public destroy() {
        this.subjects.destroy();
    }

    public bind(element: HTMLInputElement | undefined): Filter {
        element !== undefined && (this._element = element);
        return this;
    }

    public focus() {
        this._element !== undefined && this._element.focus();
    }

    public value(): string | undefined {
        return this._element !== undefined ? this._element.value : undefined;
    }

    public defaults(): {
        clearOnEscape(): boolean;
        clearOnEnter(): boolean;
    } {
        return {
            clearOnEscape: (): boolean => {
                return this.options.clearOnEscape !== undefined
                    ? this.options.clearOnEscape
                    : false;
            },
            clearOnEnter: (): boolean => {
                return this.options.clearOnEnter !== undefined ? this.options.clearOnEnter : false;
            },
        };
    }
}
