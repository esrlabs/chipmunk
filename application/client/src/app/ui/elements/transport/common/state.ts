import { Subjects, Subject } from '@platform/env/subscription';

export abstract class Base<T> {
    public subjects: Subjects<{
        accepted: Subject<void>;
    }> = new Subjects({
        accepted: new Subject(),
    });

    public abstract from(opt: T): void;
    public abstract asSourceDefinition(): T;

    public destroy(): void {
        this.subjects.destroy();
    }

    public accept(): Base<T> {
        this.subjects.get().accepted.emit();
        return this;
    }
}
