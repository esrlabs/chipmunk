import { IFilter } from '@platform/types/filter';
import { Subject } from '@platform/env/subscription';
import { bridge } from '@service/bridge';

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

    public getErrorMsg(): string | undefined {
        if (this.error === undefined) {
            return undefined;
        }
        return this.error.replace(/.*error:/i, '').trim();
    }

    public set(): {
        value(value: string): Promise<void>;
        caseSensitive(value: boolean): void;
        wholeWord(value: boolean): void;
        regex(value: boolean): void;
    } {
        return {
            value: (value: string): Promise<void> => {
                this.filter.filter = value;
                return this.update();
            },
            caseSensitive: (value: boolean) => {
                this.filter.flags.cases = value;
                this.update();
            },
            wholeWord: (value: boolean) => {
                this.filter.flags.word = value;
                this.update();
            },
            regex: (value: boolean) => {
                this.filter.flags.reg = value;
                this.update();
            },
        };
    }

    protected update(): Promise<void> {
        if (this.filter.filter.trim() === '') {
            this.error = undefined;
            this.updated.emit();
            return Promise.resolve();
        } else {
            return bridge
                .regex()
                .validate(this.filter)
                .then((err: Error | undefined) => {
                    this.error =
                        err instanceof Error ? err.message.replace(/[\n\r]/gi, '') : undefined;
                })
                .catch((err: Error) => {
                    console.error(`Fail validate regex: ${err.message}`);
                    this.error = undefined;
                })
                .finally(() => {
                    this.updated.emit();
                });
        }
    }
}
