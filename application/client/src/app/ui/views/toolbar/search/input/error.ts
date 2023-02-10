import { IFilter } from '@platform/types/filter';
import { Subject } from '@platform/env/subscription';
import { getFilterError } from '@module/util';

export class ErrorHandler {
    public error: string | undefined;
    public updated: Subject<void> = new Subject();
    public readonly filter: IFilter = {
        filter: '',
        flags: {
            reg: true,
            word: false,
            cases: false,
        },
    };

    public destroy(): void {
        this.updated.destroy();
    }

    public hasError(): boolean {
        return this.error !== undefined;
    }

    public set(): {
        value(value: string): void;
        caseSensitive(value: boolean): void;
        wholeWord(value: boolean): void;
        regex(value: boolean): void;
    } {
        return {
            value: (value: string) => {
                this.filter.filter = value;
                this._update();
            },
            caseSensitive: (value: boolean) => {
                this.filter.flags.cases = value;
                this._update();
            },
            wholeWord: (value: boolean) => {
                this.filter.flags.word = value;
                this._update();
            },
            regex: (value: boolean) => {
                this.filter.flags.reg = value;
                this._update();
            },
        };
    }

    private _update() {
        this.error = getFilterError(
            this.filter.filter,
            this.filter.flags.cases,
            this.filter.flags.word,
            this.filter.flags.reg,
        );
        if (this.error !== undefined) {
            const match: RegExpMatchArray | null = this.error.match(/error:.+/i);
            if (match !== null && match[0] !== undefined) {
                this.error = match[0].trim();
            }
        }
    }
}
