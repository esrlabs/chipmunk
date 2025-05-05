import { ElementInner } from './index';
import { Value, ValueInput } from '@platform/types/bindings';

export class NamedValuesElement<T> implements ElementInner {
    public value: T;
    public items: { key: string; value: T }[];
    constructor(
        defaults: T,
        items: { key: string; value: T }[],
        protected readonly getter: (value: T) => Value,
    ) {
        this.value = defaults;
        this.items = items;
    }

    public getInnerValue(): any {
        return this.value;
    }

    public setValue(value: any) {
        this.value = value;
    }

    public isField(): boolean {
        return true;
    }

    public getValue(): Value {
        return this.getter(this.value);
    }
}

export function tryFromOrigin(origin: ValueInput): NamedValuesElement<boolean> | undefined {
    const vl = origin as { NamedBools: Array<[string, boolean]> };
    return vl.NamedBools instanceof Array
        ? vl.NamedBools.length > 0
            ? new NamedValuesElement(
                  vl.NamedBools[0][1],
                  vl.NamedBools.map((item) => {
                      return { key: item[0], value: item[1] };
                  }),
                  (value: boolean): Value => {
                      return {
                          Boolean: value,
                      };
                  },
              )
            : undefined
        : undefined;
}
