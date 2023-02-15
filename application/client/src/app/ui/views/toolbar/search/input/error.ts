import { IFilter } from '@platform/types/filter';
import { Subject } from '@platform/env/subscription';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';

export class ErrorHandler {
    public updated: Subject<void> = new Subject();
    public readonly filter: IFilter = {
        filter: '',
        flags: {
            reg: true,
            word: false,
            cases: false,
        },
    };

    private _error: string | undefined;

    public destroy(): void {
        this.updated.destroy();
    }

    public get error(): string | undefined {
        return this.filter.flags.reg ? this._error : undefined;
    }

    public hasError(): boolean {
        return this.filter.flags.reg && this.error !== undefined;
    }

    public isValidRegex(): boolean {
        return this._error === undefined;
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
                this._checkRegex();
            },
            caseSensitive: (value: boolean) => {
                this.filter.flags.cases = value;
                this._checkRegex();
            },
            wholeWord: (value: boolean) => {
                this.filter.flags.word = value;
                this._checkRegex();
            },
            regex: (value: boolean) => {
                this.filter.flags.reg = value;
                this._checkRegex();
            },
        };
    }

    public recentSelected(value: string) {
        this.set().value(value);
    }

    private _checkRegex() {
        this._error = FilterRequest.getValidationError({
            filter: this.filter.filter,
            flags: {
                cases: this.filter.flags.cases,
                word: this.filter.flags.word,
                reg: true,
            },
        });
    }
}
