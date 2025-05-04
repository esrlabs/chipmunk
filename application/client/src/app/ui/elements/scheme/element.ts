import { Value, ValueInput } from '@platform/types/bindings';
import { Subject, Subjects } from '@platform/env/subscription';
/**
export type ValueInput =
    | { Checkbox: boolean }
    | { Number: number }
    | { String: string }
    | { Numbers: [Array<number>, number] }
    | { Strings: [Array<string>, string] }
    | { NamedBools: Array<[string, boolean]> }
    | { NamedNumbers: Array<[string, number]> }
    | { NamedStrings: Array<[string, string]> }
    | { KeyNumber: Map<string, number> }
    | { KeyNumbers: Map<string, number[]> }
    | { KeyString: Map<string, string> }
    | { KeyStrings: Map<string, string[]> }
    | { NestedNumbersMap: Map<string, Map<string, Map<string, number>>> }
    | 'Directories'
    | 'Files'
    | 'File'
    | 'Directory'
    | { Bound: { output: ValueInput; inputs: Array<ValueInput> } };
 */

interface ValueGetter {
    getValue(): Value;
}

export type NestedDictionaryStructure = Map<string, Map<string, Map<string, number | string>>>;

export class NestedDictionary<V> implements ValueGetter {
    public value: V;
    constructor(
        public defaults: V,
        public readonly items: NestedDictionaryStructure,
        public readonly dictionary: Map<string, string>,
        protected readonly getter: (value: V) => Value,
    ) {
        this.value = defaults;
    }
    public getValue(): Value {
        return this.getter(this.value);
    }
}

export class CheckboxElement implements ValueGetter {
    public value: boolean;
    constructor(public defaults: boolean = false) {
        this.value = defaults;
    }
    public getValue(): Value {
        return { Boolean: this.value };
    }
}

export class InputElement<T> implements ValueGetter {
    public value: T;
    constructor(public defaults: T, protected readonly getter: (value: T) => Value) {
        this.value = defaults;
    }
    public getValue(): Value {
        return this.getter(this.value);
    }
}

export class ListElement<T> implements ValueGetter {
    public value: T;
    public items: T[];
    constructor(defaults: T, items: T[], protected readonly getter: (value: T) => Value) {
        this.value = defaults;
        this.items = items;
    }
    public getValue(): Value {
        return this.getter(this.value);
    }
}

export class NamedValuesElement<T> implements ValueGetter {
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
    public getValue(): Value {
        return this.getter(this.value);
    }
}

export interface ChangeEvent {
    uuid: string;
    inner: any;
    value: Value;
}

export class Element {
    public checkbox: CheckboxElement | undefined;
    public numeric_list: ListElement<number> | undefined;
    public strings_list: ListElement<string> | undefined;
    public string_input: InputElement<string> | undefined;
    public number_input: InputElement<number> | undefined;
    public named: NamedValuesElement<boolean> | undefined;
    public nested_dictionary: NestedDictionary<string[]> | undefined;

    public readonly subjects: Subjects<{
        changed: Subject<ChangeEvent>;
        loaded: Subject<void>;
    }> = new Subjects({
        changed: new Subject<ChangeEvent>(),
        loaded: new Subject<void>(),
    });

    constructor(protected readonly uuid: string, protected readonly origin: ValueInput) {
        this.checkbox = Element.as_checkbox(origin);
        this.numeric_list = Element.as_numbers_list(origin);
        this.strings_list = Element.as_string_list(origin);
        this.string_input = Element.as_string(origin);
        this.number_input = Element.as_number(origin);
        this.named = Element.as_named_bools(origin);
        this.nested_dictionary = Element.as_nested_dictionary_numeric(origin);
    }

    public loaded() {
        this.subjects.get().loaded.emit();
    }

    public isField(): boolean {
        return (
            this.checkbox !== undefined ||
            this.numeric_list !== undefined ||
            this.strings_list !== undefined ||
            this.string_input !== undefined ||
            this.number_input !== undefined ||
            this.named !== undefined
        );
    }

    public change() {
        const value = this.getValue();
        if (!value) {
            return;
        }
        if (this.checkbox !== undefined) {
            this.subjects
                .get()
                .changed.emit({ uuid: this.uuid, inner: this.checkbox.value, value });
        } else if (this.numeric_list !== undefined) {
            this.subjects
                .get()
                .changed.emit({ uuid: this.uuid, inner: this.numeric_list.value, value });
        } else if (this.strings_list !== undefined) {
            this.subjects
                .get()
                .changed.emit({ uuid: this.uuid, inner: this.strings_list.value, value });
        } else if (this.string_input !== undefined) {
            this.subjects
                .get()
                .changed.emit({ uuid: this.uuid, inner: this.string_input.value, value });
        } else if (this.number_input !== undefined) {
            this.subjects
                .get()
                .changed.emit({ uuid: this.uuid, inner: this.number_input.value, value });
        } else if (this.named !== undefined) {
            this.subjects.get().changed.emit({ uuid: this.uuid, inner: this.named.value, value });
        } else if (this.nested_dictionary !== undefined) {
            this.subjects
                .get()
                .changed.emit({ uuid: this.uuid, inner: this.nested_dictionary.value, value });
        }
    }

    public setValue(value: any) {
        if (this.checkbox !== undefined) {
            this.checkbox.value = value;
        } else if (this.numeric_list !== undefined) {
            this.numeric_list.value = value;
        } else if (this.strings_list !== undefined) {
            this.strings_list.value = value;
        } else if (this.string_input !== undefined) {
            this.string_input.value = value;
        } else if (this.number_input !== undefined) {
            this.number_input.value = value;
        } else if (this.named !== undefined) {
            this.named.value = value;
        } else if (this.nested_dictionary !== undefined) {
            this.nested_dictionary.value = value;
        }
    }

    /*
    | { Numbers: Array<number> }
    | { Strings: Array<string> }
    | { Directories: Array<string> }
    | { Files: Array<string> }
    | { File: string }
    | { Directory: string }
    | { KeyNumber: Map<string, number> }
    | { KeyNumbers: Map<string, number[]> }
    | { KeyString: Map<string, string> }
    | { KeyStrings: Map<string, string[]> };
*/
    public getValue(): Value | undefined {
        if (this.checkbox !== undefined) {
            return this.checkbox.getValue();
        } else if (this.numeric_list !== undefined) {
            return this.numeric_list.getValue();
        } else if (this.strings_list !== undefined) {
            return this.strings_list.getValue();
        } else if (this.string_input !== undefined) {
            return this.string_input.getValue();
        } else if (this.number_input !== undefined) {
            return this.number_input.getValue();
        } else if (this.named !== undefined) {
            return this.named.getValue();
        } else if (this.nested_dictionary !== undefined) {
            return this.nested_dictionary.getValue();
        }
        return undefined;
    }

    static as_checkbox(origin: ValueInput): CheckboxElement | undefined {
        const vl = origin as { Checkbox: boolean };
        return typeof vl.Checkbox === 'boolean' ? new CheckboxElement(vl.Checkbox) : undefined;
    }

    static as_string(origin: ValueInput): InputElement<string> | undefined {
        const vl = origin as { String: string };
        return typeof vl.String === 'string'
            ? new InputElement<string>(vl.String, (value: string): Value => {
                  return { String: value };
              })
            : undefined;
    }

    static as_number(origin: ValueInput): InputElement<number> | undefined {
        const vl = origin as { Number: number };
        return typeof vl.Number === 'number'
            ? new InputElement<number>(vl.Number, (value: number): Value => {
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

    static as_numbers_list(origin: ValueInput): ListElement<number> | undefined {
        const vl = origin as { Numbers: [Array<number>, number] };
        return vl.Numbers
            ? new ListElement(vl.Numbers[1], vl.Numbers[0], (value: number): Value => {
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

    static as_string_list(origin: ValueInput): ListElement<string> | undefined {
        const vl = origin as { Strings: [Array<string>, string] };
        return vl.Strings
            ? new ListElement(vl.Strings[1], vl.Strings[0], (value: string): Value => {
                  return {
                      String: value,
                  };
              })
            : undefined;
    }

    static as_named_bools(origin: ValueInput): NamedValuesElement<boolean> | undefined {
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

    static as_nested_dictionary_numeric(
        origin: ValueInput,
    ): NestedDictionary<string[]> | undefined {
        const vl = origin as {
            NestedNumbersMap: [Map<string, Map<string, Map<string, number>>>, Map<string, string>];
        };
        return vl.NestedNumbersMap instanceof Array && vl.NestedNumbersMap.length === 2
            ? new NestedDictionary<string[]>(
                  [],
                  vl.NestedNumbersMap[0],
                  vl.NestedNumbersMap[1],
                  (selections: string[]) => {
                      return { Strings: selections };
                  },
              )
            : undefined;
    }
}
