import { ElementInner } from './index';
import { Value, ValueInput } from '@platform/types/bindings';

export class CheckboxElement implements ElementInner {
    public value: boolean;

    constructor(public defaults: boolean = false) {
        this.value = defaults;
    }

    public getInnerValue(): any {
        return this.value;
    }

    public isField(): boolean {
        return true;
    }
    public setValue(value: any) {
        this.value = value;
    }

    public getValue(): Value {
        return { Boolean: this.value };
    }
}

export function tryFromOrigin(origin: ValueInput): CheckboxElement | undefined {
    const vl = origin as { Checkbox: boolean };
    return typeof vl.Checkbox === 'boolean' ? new CheckboxElement(vl.Checkbox) : undefined;
}
