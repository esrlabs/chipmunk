import { Field, FieldDesc, StaticFieldDesc, Value } from '@platform/types/bindings';
import { Subscriber, Subject, Subjects } from '@platform/env/subscription';
import { unique } from '@platform/env/sequence';

export interface ForcedValueChanges {
    target: string;
    value: any;
}
export abstract class SchemeProvider extends Subscriber {
    public subjects: Subjects<{
        loaded: Subject<StaticFieldDesc>;
        forced: Subject<ForcedValueChanges>;
        error: Subject<Map<string, string>>;
    }> = new Subjects({
        loaded: new Subject<StaticFieldDesc>(),
        forced: new Subject<ForcedValueChanges>(),
        error: new Subject<Map<string, string>>(),
    });

    constructor(public readonly uuid: string) {
        super();
    }
    public abstract getFieldDescs(): FieldDesc[];
    public abstract load(): Promise<void>;
    public abstract destroy(): Promise<void>;
    public abstract setValue(uuid: string, value: Value): void;
    public abstract getFields(): Field[];
    public abstract isValid(): boolean;
    public force(target: string, value: any) {
        this.subjects.get().forced.emit({ target, value });
    }
}
