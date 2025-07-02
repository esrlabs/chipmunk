import { ElementInner, FieldCategory } from './inner';
import { Value, ValueInput } from '@platform/types/bindings';

enum InnerType {
    String,
    Number,
}

export class InputElement<T> extends ElementInner {
    public value: T;

    constructor(
        public defaults: T,
        public placeholder: string,
        protected readonly innerType: InnerType,
        protected readonly getter: (value: T) => Value,
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

export function tryFromOrigin(origin: ValueInput): InputElement<string | number> | undefined {
    function as_string(origin: ValueInput): InputElement<string> | undefined {
        const vl = origin as { String: [string, string] };
        return typeof vl.String[0] === 'string'
            ? new InputElement<string>(
                  vl.String[0],
                  vl.String[1],
                  InnerType.String,
                  (value: string): Value => {
                      return { String: value };
                  },
              )
            : undefined;
    }

    function as_number(origin: ValueInput): InputElement<number> | undefined {
        const vl = origin as { Number: number };
        return typeof vl.Number === 'number'
            ? new InputElement<number>(vl.Number, '', InnerType.Number, (value: number): Value => {
                  return {
                      Number:
                          typeof value === 'number'
                              ? value
                              : typeof value === 'string'
                              ? parseInt(value, 10)
                              : 0,
                  };
              })
            : undefined;
    }
    if ((origin as { Number: number }).Number !== undefined) {
        return as_number(origin) as InputElement<string | number>;
    } else if ((origin as { String: [string, string] }).String !== undefined) {
        return as_string(origin) as InputElement<string | number>;
    } else {
        return undefined;
    }
}
