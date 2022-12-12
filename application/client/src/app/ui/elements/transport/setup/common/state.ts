import { Subjects, Subject } from '@platform/env/subscription';

export abstract class Base<T> {
    public subjects: Subjects<{
        accepted: Subject<void>;
        updated: Subject<void>;
    }> = new Subjects({
        accepted: new Subject(),
        updated: new Subject(),
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

    public update(): Base<T> {
        this.subjects.get().updated.emit();
        return this;
    }
}
