import { ElementInner } from './index';
import { Value, ValueInput } from '@platform/types/bindings';

export type NestedDictionaryStructure = Map<string, Map<string, Map<string, number | string>>>;

export class NestedDictionaryElement<V> implements ElementInner {
    public value: V;
    constructor(
        public defaults: V,
        public readonly items: NestedDictionaryStructure,
        public readonly dictionary: Map<string, string>,
        protected readonly getter: (value: V) => Value,
    ) {
        this.value = defaults;
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
        return this.getter(this.value);
    }
}

export function tryFromOrigin(origin: ValueInput): NestedDictionaryElement<string[]> | undefined {
    const vl = origin as {
        NestedNumbersMap: [Map<string, Map<string, Map<string, number>>>, Map<string, string>];
    };
    return vl.NestedNumbersMap instanceof Array && vl.NestedNumbersMap.length === 2
        ? new NestedDictionaryElement<string[]>(
              [],
              vl.NestedNumbersMap[0],
              vl.NestedNumbersMap[1],
              (selections: string[]) => {
                  return { Strings: selections };
              },
          )
        : undefined;
}
