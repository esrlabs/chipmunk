import { ElementInner, Element } from '../index';
import { StaticFieldDesc, Value, ValueInput } from '@platform/types/bindings';
import { Provider } from './provider';

import * as obj from '@platform/env/obj';

export class FieldsCollectionElement implements ElementInner {
    public value: number = -1;

    public elements: Element[][] = [];
    public provider: Provider = new Provider();

    public constructor(
        public readonly spec: StaticFieldDesc[],
        public readonly addTitle: string | undefined,
    ) {}

    public add(): void {
        const collection = this.spec.map((field) => {
            return new Element(field.id + '__', field.interface);
        });
        this.elements.push(collection);
    }

    public getInnerValue(): any {
        return this.value;
    }

    public setValue(value: any) {
        this.value = value;
    }

    public isField(): boolean {
        return false;
    }

    public getValue(): Value {
        return { Number: this.value };
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
