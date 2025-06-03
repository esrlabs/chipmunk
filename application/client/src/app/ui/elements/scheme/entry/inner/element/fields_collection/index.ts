import { Element } from '../index';
import { ElementInner, FieldCategory } from '../inner';
import { StaticFieldDesc, Value, ValueInput, Field } from '@platform/types/bindings';
import { Provider } from './provider';
import { Subscriber, Subject } from '@platform/env/subscription';
import { SchemeProvider } from '@ui/elements/scheme/provider';

class Collection extends Subscriber {
    static from(
        spec: StaticFieldDesc[],
        uuid: string,
        idx: number,
        handler: () => void,
    ): Collection {
        const elements: Element[] = spec.map(
            (field, i) => new Element(`${uuid}:${idx}:${i}`, field.interface),
        );
        return new Collection(elements, handler);
    }

    public checkErrors(errors: Map<string, string>) {
        this.dropErrors();
        errors.forEach((msg, uuid) => {
            const element = this.elements.find((el) => el.uuid == uuid);
            if (!element) {
                return;
            }
            element.setError(msg);
        });
    }

    constructor(public readonly elements: Element[], handler: () => void) {
        super();
        this.register(...elements.map((el) => el.subjects.get().changed.subscribe(handler)));
    }

    public getFields(uuid: string, idx: number): Value {
        return {
            Fields: this.elements.map((el, n) => {
                return { id: `${uuid}:${idx}:${n}`, value: el.getValue() };
            }),
        };
    }

    public dropErrors() {
        this.elements.forEach((el) => el.setError(undefined));
    }
}

export class FieldsCollectionElement extends ElementInner {
    protected update() {
        this.values = this.collections.map((collection, idx) =>
            collection.getFields(this.parent.uuid, idx),
        );
        this.parent.subjects
            .get()
            .changed.emit({ uuid: this.parent.uuid, inner: undefined, value: this.getValue() });
        console.log(this.values);
    }

    public parent!: Element;
    public collections: Collection[] = [];
    public values: Value[] = [];
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

    public override setProviderRef(provider: SchemeProvider): void {
        this.register(
            provider.subjects.get().error.subscribe((errors: Map<string, string>) => {
                this.collections.forEach((collection) => {
                    collection.checkErrors(errors);
                });
                this.parent.emitError();
            }),
        );
    }

    public override destroy() {
        this.collections.forEach((collection) => collection.unsubscribe());
        this.unsubscribe();
    }

    public add(): void {
        this.collections.push(
            Collection.from(this.spec, this.parent.uuid, this.collections.length, this.update),
        );
        this.parent.change();
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

    public getFieldCategory(): FieldCategory {
        return FieldCategory.Row;
    }

    public getValue(): Value {
        return {
            Fields: this.collections.map((collection, idx) => {
                return {
                    id: `${this.parent.uuid}:${idx}`,
                    value: collection.getFields(this.parent.uuid, idx),
                };
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
