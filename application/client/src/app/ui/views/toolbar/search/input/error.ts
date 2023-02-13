import { IFilter } from '@platform/types/filter';
import { Subject } from '@platform/env/subscription';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';

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

    private _isValidRegex: boolean = true;
    private _isActiveSearchValidRegex: boolean | undefined;

    public destroy(): void {
        this.updated.destroy();
    }

    public hasError(): boolean {
        return this.error !== undefined;
    }

    public get isValidRegex(): boolean {
        return this._isActiveSearchValidRegex === undefined
            ? this._isValidRegex
            : this._isActiveSearchValidRegex;
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

    public recentSelected(value: string, hasActiveSearch: boolean) {
        this.set().value(value);
        this._isActiveSearchValidRegex = hasActiveSearch ? this._isValidRegex : undefined;
    }

    private _update() {
        this._checkSpecifiedRegex();
        this._checkGeneralRegex();
    }

    private _checkSpecifiedRegex() {
        this.error = FilterRequest.isValidErrorMessage(
            this.filter.filter,
            this.filter.flags.cases,
            this.filter.flags.word,
            this.filter.flags.reg,
        );
    }

    private _checkGeneralRegex() {
        this._isValidRegex = FilterRequest.isValid(
            this.filter.filter,
            this.filter.flags.cases,
            this.filter.flags.word,
            true,
        );
    }
}
