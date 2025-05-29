import { Element } from '../index';
import { ElementInner } from '../inner';
import { StaticFieldDesc, Value, ValueInput } from '@platform/types/bindings';
import { Provider } from './provider';
import { Subscriber, Subject } from '@platform/env/subscription';

class Collection extends Subscriber {
    static from(spec: StaticFieldDesc[], idx: number, handler: () => void): Collection {
        const elements: Element[] = spec.map(
            (field, i) => new Element(`${idx}_${i}`, field.interface),
        );
        return new Collection(elements, handler);
    }

    constructor(public readonly elements: Element[], handler: () => void) {
        super();
        this.register(...elements.map((el) => el.subjects.get().changed.subscribe(handler)));
    }

    public getValues(): Value[] {
        return this.elements.map((el) => el.getValue());
    }
}

export class FieldsCollectionElement extends ElementInner {
    protected update() {
        this.values = this.collections.map((collection) => collection.getValues());
        this.parent.subjects
            .get()
            .changed.emit({ uuid: this.parent.uuid, inner: undefined, value: this.getValue() });
        console.log(this.values);
    }

    public parent!: Element;
    public collections: Collection[] = [];
    public values: Value[][] = [];
    public provider: Provider = new Provider();

    public constructor(
        public readonly spec: StaticFieldDesc[],
        public readonly addTitle: string | undefined,
    ) {
        super();
        this.update = this.update.bind(this);
    }

    public override setParentRef(parent: Element): void {
        this.parent = parent;
    }

    public destroy() {
        this.collections.forEach((collection) => collection.unsubscribe());
    }

    public add(): void {
        this.collections.push(Collection.from(this.spec, this.collections.length, this.update));
    }
    public remove(idx: number) {
        this.collections.splice(idx, 1).forEach((collection) => collection.unsubscribe());
    }

    public getInnerValue(): any {
        return undefined;
    }

    public setValue(_value: any) {
        // Do nothing. This is just a wrapper
    }

    public isField(): boolean {
        return false;
    }

    public getValue(): Value {
        return {
            Values: this.collections.map((collection) => {
                return { Values: collection.getValues() };
            }),
        };
    }
}

export function tryFromOrigin(origin: ValueInput): FieldsCollectionElement | undefined {
    const vl = origin as {
        FieldsCollection: { elements: StaticFieldDesc[]; add_title: string };
    };
    if (!vl.FieldsCollection) {
        return undefined;
    }
    return new FieldsCollectionElement(
        vl.FieldsCollection.elements,
        vl.FieldsCollection.add_title.trim() === '' ? undefined : vl.FieldsCollection.add_title,
    );
}
