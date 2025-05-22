import { FieldDesc, StaticFieldDesc, Value } from '@platform/types/bindings';
import { Subscriber, Subject, Subjects } from '@platform/env/subscription';
import { unique } from '@platform/env/sequence';

export interface ForcedValueChanges {
    target: string;
    value: any;
}
export abstract class SchemeProvider extends Subscriber {
    public readonly id: string;
    public subjects: Subjects<{
        loaded: Subject<StaticFieldDesc>;
        forced: Subject<ForcedValueChanges>;
        error: Subject<Map<string, string>>;
    }> = new Subjects({
        loaded: new Subject<StaticFieldDesc>(),
        forced: new Subject<ForcedValueChanges>(),
        error: new Subject<Map<string, string>>(),
    });

    constructor() {
        super();
        this.id = unique();
    }
    public abstract get(): Promise<FieldDesc[]>;
    public abstract destroy(): Promise<void>;
    public abstract setValue(uuid: string, value: Value): void;
    public force(target: string, value: any) {
        this.subjects.get().forced.emit({ target, value });
    }
}
