import { IlcInterface } from '@service/ilc';
import { Subject, Subjects } from '@platform/env/subscription';

export type Handler = () => void;

export interface Options {
    clearOnEscape?: boolean;
    clearOnEnter?: boolean;
}

export class Filter {
    private readonly _options: Options;
    public readonly subjects: Subjects<{
        change: Subject<string>;
        drop: Subject<void>;
        enter: Subject<string>;
        focus: Subject<void>;
        blur: Subject<void>;
    }> = new Subjects({
        change: new Subject<string>(),
        drop: new Subject<void>(),
        enter: new Subject<string>(),
        focus: new Subject<void>(),
        blur: new Subject<void>(),
    });
    private _element!: HTMLInputElement;

    constructor(ilc: IlcInterface, options?: Options) {
        ilc.life().destroy(() => {
            this.subjects.destroy();
        });
        this._options = options === undefined ? {} : options;
    }

    public bind(element: HTMLInputElement) {
        this._element = element;
    }

    public focus() {
        this._element.focus();
    }

    public value(): string {
        return this._element.value;
    }

    public options(): {
        clearOnEscape(): boolean;
        clearOnEnter(): boolean;
    } {
        return {
            clearOnEscape: (): boolean => {
                return this._options === undefined
                    ? false
                    : this._options.clearOnEscape !== undefined
                    ? this._options.clearOnEscape
                    : false;
            },
            clearOnEnter: (): boolean => {
                return this._options === undefined
                    ? false
                    : this._options.clearOnEnter !== undefined
                    ? this._options.clearOnEnter
                    : false;
            },
        };
    }
}
