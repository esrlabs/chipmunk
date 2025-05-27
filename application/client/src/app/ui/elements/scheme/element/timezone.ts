import { ElementInner } from './index';
import { Value, ValueInput } from '@platform/types/bindings';

export class TimezoneSelectorElement implements ElementInner {
    public value: number = -1;

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

export function tryFromOrigin(origin: ValueInput): TimezoneSelectorElement | undefined {
    if (typeof origin === 'string' && origin === 'Timezone') {
        return new TimezoneSelectorElement();
    } else {
        return undefined;
    }
}
