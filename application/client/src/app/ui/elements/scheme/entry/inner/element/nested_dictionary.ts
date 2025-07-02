import { ElementInner, FieldCategory } from './inner';
import { Value, ValueInput } from '@platform/types/bindings';

export type NestedDictionaryStructure = Map<string, Map<string, Map<string, number | string>>>;

export class NestedDictionaryElement<V> extends ElementInner {
    public value: V;
    constructor(
        public defaults: V,
        public readonly items: NestedDictionaryStructure,
        public readonly dictionary: Map<string, string>,
        protected readonly getter: (value: V) => Value,
    ) {
        super();
        this.value = defaults;
    }

    public getInnerValue(): any {
        return this.value;
    }

    public setValue(value: any) {
        this.value = value;
    }

    public getFieldCategory(): FieldCategory {
        return FieldCategory.Block;
    }

    public getValue(): Value {
        return this.getter(this.value);
    }
}

export function tryFromOrigin(
    origin: ValueInput,
): NestedDictionaryElement<Map<string, string[]>> | undefined {
    const vl = origin as {
        NestedNumbersMap: [Map<string, Map<string, Map<string, number>>>, Map<string, string>];
    };
    return vl.NestedNumbersMap instanceof Array && vl.NestedNumbersMap.length === 2
        ? new NestedDictionaryElement<Map<string, string[]>>(
              new Map(),
              vl.NestedNumbersMap[0],
              vl.NestedNumbersMap[1],
              (selections: Map<string, string[]>) => {
                  return { KeyStrings: selections };
              },
          )
        : undefined;
}
