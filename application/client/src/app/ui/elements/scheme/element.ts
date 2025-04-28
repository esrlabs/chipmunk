import { ValueInput } from '@platform/types/bindings';
import { Subject } from '@platform/env/subscription';
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
    | 'Directories'
    | 'Files'
    | 'File'
    | 'Directory'
    | { Bound: { output: ValueInput; inputs: Array<ValueInput> } };



 */

export class CheckboxElement {
    public value: boolean;
    constructor(public defaults: boolean = false) {
        this.value = defaults;
    }
}

export class InputElement<T> {
    public value: T | undefined;
    constructor(public defaults: T) {
        this.value = defaults;
    }
}

export class ListElement<T> {
    public value: T | undefined;
    public items: T[];
    constructor(defaults: T | undefined, items: T[]) {
        this.value = defaults;
        this.items = items;
    }
}

export class NamedValuesElement<T> {
    public value: T | undefined;
    public items: { key: string; value: T }[];
    constructor(defaults: T | undefined, items: { key: string; value: T }[]) {
        this.value = defaults;
        this.items = items;
    }
}

export interface ChangeEvent {
    uuid: string;
    value: any;
}

export class Element {
    public checkbox: CheckboxElement | undefined;
    public numeric_list: ListElement<number> | undefined;
    public strings_list: ListElement<string> | undefined;
    public string_input: InputElement<string> | undefined;
    public number_input: InputElement<number> | undefined;
    public named: NamedValuesElement<boolean> | undefined;

    public readonly changed: Subject<ChangeEvent> = new Subject();

    constructor(protected readonly uuid: string, protected readonly origin: ValueInput) {
        this.checkbox = Element.as_checkbox(origin);
        this.numeric_list = Element.as_numbers_list(origin);
        this.strings_list = Element.as_string_list(origin);
        this.string_input = Element.as_string(origin);
        this.number_input = Element.as_number(origin);
        this.named = Element.as_named_bools(origin);
    }

    public change() {
        if (this.checkbox !== undefined) {
            this.changed.emit({ uuid: this.uuid, value: this.checkbox.value });
        } else if (this.numeric_list !== undefined) {
            this.changed.emit({ uuid: this.uuid, value: this.numeric_list.value });
        } else if (this.strings_list !== undefined) {
            this.changed.emit({ uuid: this.uuid, value: this.strings_list.value });
        } else if (this.string_input !== undefined) {
            this.changed.emit({ uuid: this.uuid, value: this.string_input.value });
        } else if (this.number_input !== undefined) {
            this.changed.emit({ uuid: this.uuid, value: this.number_input.value });
        } else if (this.named !== undefined) {
            this.changed.emit({ uuid: this.uuid, value: this.named.value });
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
        }
    }

    static as_checkbox(origin: ValueInput): CheckboxElement | undefined {
        const vl = origin as { Checkbox: boolean };
        return typeof vl.Checkbox === 'boolean' ? new CheckboxElement(vl.Checkbox) : undefined;
    }

    static as_string(origin: ValueInput): InputElement<string> | undefined {
        const vl = origin as { String: string };
        return typeof vl.String === 'string' ? new InputElement<string>(vl.String) : undefined;
    }

    static as_number(origin: ValueInput): InputElement<number> | undefined {
        const vl = origin as { Number: number };
        return typeof vl.Number === 'number' ? new InputElement<number>(vl.Number) : undefined;
    }

    static as_numbers_list(origin: ValueInput): ListElement<number> | undefined {
        const vl = origin as { Numbers: [Array<number>, number] };
        return vl.Numbers ? new ListElement(vl.Numbers[1], vl.Numbers[0]) : undefined;
    }

    static as_string_list(origin: ValueInput): ListElement<string> | undefined {
        const vl = origin as { Strings: [Array<string>, string] };
        return vl.Strings ? new ListElement(vl.Strings[1], vl.Strings[0]) : undefined;
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
                  )
                : undefined
            : undefined;
    }
}
