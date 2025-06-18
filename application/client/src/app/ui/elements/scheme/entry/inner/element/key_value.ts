import { ElementInner, FieldCategory } from './inner';
import { Value, ValueInput } from '@platform/types/bindings';

enum InnerType {
    String,
    Number,
}

export class KeyValueElement<K, V> extends ElementInner {
    public value: V;
    public items: [K, V][];
    constructor(
        defaults: V,
        items: [K, V][],
        protected readonly innerType: InnerType,
        protected readonly getter: (value: V) => Value,
    ) {
        super();
        this.value = defaults;
        this.items = items;
    }

    public getInnerValue(): any {
        return this.value;
    }

    public setValue(value: any) {
        this.value = value;
    }

    public getFieldCategory(): FieldCategory {
        return FieldCategory.Inline;
    }

    public getValue(): Value {
        return this.getter(this.value);
    }
    public isNumeric(): boolean {
        return this.innerType === InnerType.Number;
    }

    public isString(): boolean {
        return this.innerType === InnerType.String;
    }
}

export function tryFromOrigin(origin: ValueInput): KeyValueElement<string, any> | undefined {
    function as_named_numbers(origin: ValueInput): KeyValueElement<string, number> | undefined {
        const vl = origin as { NamedNumbers: [[string, number][], number] };
        return vl.NamedNumbers
            ? new KeyValueElement(
                  vl.NamedNumbers[1],
                  vl.NamedNumbers[0],
                  InnerType.Number,
                  (value: number): Value => {
                      return {
                          Number:
                              typeof value === 'number'
                                  ? value
                                  : typeof value === 'string'
                                  ? parseInt(value, 10)
                                  : 0,
                      };
                  },
              )
            : undefined;
    }
    function as_named_strings(origin: ValueInput): KeyValueElement<string, string> | undefined {
        const vl = origin as { NamedStrings: [[string, string][], string] };
        return vl.NamedStrings
            ? new KeyValueElement(
                  vl.NamedStrings[1],
                  vl.NamedStrings[0],
                  InnerType.String,
                  (value: unknown): Value => {
                      return {
                          String:
                              typeof value === 'string'
                                  ? value
                                  : value
                                  ? typeof value.toString === 'function'
                                      ? value.toString()
                                      : ''
                                  : '',
                      };
                  },
              )
            : undefined;
    }
    if ((origin as { NamedNumbers: [[string, number][], number] }).NamedNumbers) {
        return as_named_numbers(origin) as KeyValueElement<string, number>;
    } else if ((origin as { NamedStrings: [[string, string][], string] }).NamedStrings) {
        return as_named_strings(origin) as KeyValueElement<string, string>;
    } else {
        return undefined;
    }
}
