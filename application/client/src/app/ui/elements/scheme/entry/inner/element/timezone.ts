import { ElementInner, FieldCategory } from './inner';
import { Value, ValueInput } from '@platform/types/bindings';

export class TimezoneSelectorElement extends ElementInner {
    public value: number = -1;

    public getInnerValue(): any {
        return this.value;
    }

    public setValue(value: any) {
        this.value = value;
    }

    public getFieldCategory(): FieldCategory {
        return FieldCategory.Row;
    }

    public getValue(): Value {
        return { Number: this.value };
    }
}

export function tryFromOrigin(origin: ValueInput): TimezoneSelectorElement | undefined {
    if (typeof origin === 'string' && origin === 'Timezone') {
        return new TimezoneSelectorElement();
    } else {
        return undefined;
    }
}
