import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subject, Subscriber } from '@platform/env/subscription';
import { SearchValuesResult } from '@platform/types/filter';

@SetupLogger()
export class Values extends Subscriber {
    public updated: Subject<void> = new Subject();
    protected values: SearchValuesResult = new Map();

    public destroy(): void {
        this.updated.destroy();
        this.unsubscribe();
    }

    public get(): SearchValuesResult {
        return this.values;
    }

    public merge(values: SearchValuesResult): Values {
        this.values = new Map([...this.values].concat([...values]));
        this.updated.emit();
        return this;
    }

    public drop(silence: boolean = false): Values {
        this.values = new Map();
        !silence && this.updated.emit();
        return this;
    }
}
export interface Values extends LoggerInterface {}
