import { ElementInner, FieldCategory } from './inner';
import { Value, ValueInput } from '@platform/types/bindings';

enum InnerType {
    String,
    Number,
}

export class ListElement<T> extends ElementInner {
    public value: T;
    public items: T[];
    constructor(
        defaults: T,
        items: T[],
        protected readonly innerType: InnerType,
        protected readonly getter: (value: T) => Value,
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

export function tryFromOrigin(origin: ValueInput): ListElement<number | string> | undefined {
    function as_numbers_list(origin: ValueInput): ListElement<number> | undefined {
        const vl = origin as { Numbers: [Array<number>, number] };
        return vl.Numbers
            ? new ListElement(
                  vl.Numbers[1],
                  vl.Numbers[0],
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
    function as_string_list(origin: ValueInput): ListElement<string> | undefined {
        const vl = origin as { Strings: [Array<string>, string] };
        return vl.Strings
            ? new ListElement(
                  vl.Strings[1],
                  vl.Strings[0],
                  InnerType.String,
                  (value: string): Value => {
                      return {
                          String: value,
                      };
                  },
              )
            : undefined;
    }
    if ((origin as { Numbers: [Array<number>, number] }).Numbers) {
        return as_numbers_list(origin) as ListElement<number | string>;
    } else if ((origin as { Strings: [Array<string>, string] }).Strings) {
        return as_string_list(origin) as ListElement<number | string>;
    } else {
        return undefined;
    }
}
