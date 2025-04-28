import { FieldDesc, StaticFieldDesc } from '@platform/types/bindings';
import { Subscriber, Subject, Subjects } from '@platform/env/subscription';
import { unique } from '@platform/env/sequence';

export abstract class SchemeProvider extends Subscriber {
    public readonly id: string;
    constructor() {
        super();
        this.id = unique();
    }
    public abstract get(): Promise<FieldDesc[]>;
    public abstract destroy(): Promise<void>;
    public abstract subjects(): Subjects<{
        loaded: Subject<StaticFieldDesc>;
        error: Subject<Map<string, string>>;
    }>;
}
