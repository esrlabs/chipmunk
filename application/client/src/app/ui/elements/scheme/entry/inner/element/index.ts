import { Value, ValueInput } from '@platform/types/bindings';
import { Subject, Subjects } from '@platform/env/subscription';

import * as CheckboxElement from './checkbox';
import * as FilesFolderSelectorElement from './files_selector';
import * as InputElement from './input_field';
import * as ListElement from './list';
import * as NamedValuesElement from './named';
import * as NestedDictionaryElement from './nested_dictionary';
import * as TimezoneSelectorElement from './timezone';
import * as FieldsCollectionElement from './fields_collection';

export { CheckboxElement } from './checkbox';
export { FilesFolderSelectorElement } from './files_selector';
export { InputElement } from './input_field';
export { ListElement } from './list';
export { NamedValuesElement } from './named';
export { NestedDictionaryElement, NestedDictionaryStructure } from './nested_dictionary';
export { TimezoneSelectorElement } from './timezone';
export { FieldsCollectionElement } from './fields_collection';

/**
export type ValueInput =
    | { Checkbox: boolean }
    | { Number: number }
    | { String: [string, string] }
    | { Numbers: [Array<number>, number] }
    | { Strings: [Array<string>, string] }
    | { NamedBools: Array<[string, boolean]> }
    | { NamedNumbers: Array<[string, number]> }
    | { NamedStrings: Array<[string, string]> }
    | { KeyNumber: Map<string, number> }
    | { KeyNumbers: Map<string, number[]> }
    | { KeyString: Map<string, string> }
    | { KeyStrings: Map<string, string[]> }
    | { NestedNumbersMap: [Map<string, Map<string, Map<string, number>>>, Map<string, string>] }
    | { NestedStringsMap: [Map<string, Map<string, Map<string, string>>>, Map<string, string>] }
    | 'Directories'
    | { Files: Array<string> }
    | { File: Array<string> }
    | 'Directory'
    | 'Timezone'
    | { InputsCollection: { elements: Array<ValueInput>; add_title: string } }
    | { FieldsCollection: { elements: Array<StaticFieldDesc>; add_title: string } }
    | { Bound: { output: ValueInput; inputs: Array<ValueInput> } };
 */

export abstract class ElementInner {
    public abstract getValue(): Value;
    public abstract getInnerValue(): any;
    public abstract setValue(value: any): void;
    public abstract isField(): boolean;
}

export interface ChangeEvent {
    uuid: string;
    inner: any;
    value: Value;
}

export class Element {
    public readonly inner: ElementInner;

    public readonly subjects: Subjects<{
        changed: Subject<ChangeEvent>;
        loaded: Subject<void>;
    }> = new Subjects({
        changed: new Subject<ChangeEvent>(),
        loaded: new Subject<void>(),
    });

    constructor(protected readonly uuid: string, protected readonly origin: ValueInput) {
        let inner = undefined;
        for (let el of [
            CheckboxElement,
            FilesFolderSelectorElement,
            InputElement,
            ListElement,
            NamedValuesElement,
            NestedDictionaryElement,
            TimezoneSelectorElement,
            FieldsCollectionElement,
        ]) {
            let element = el.tryFromOrigin(origin);
            if (element !== undefined) {
                inner = element;
                break;
            }
        }
        if (inner) {
            this.inner = inner;
        } else {
            throw new Error(`No controller for element ${JSON.stringify(origin)}`);
        }
    }

    public loaded() {
        this.subjects.get().loaded.emit();
    }

    public isField(): boolean {
        return this.inner.isField();
    }

    public change() {
        this.subjects.get().changed.emit({
            uuid: this.uuid,
            inner: this.inner.getInnerValue(),
            value: this.inner.getValue(),
        });
    }

    public setValue(value: any) {
        this.inner.setValue(value);
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
    public getValue(): Value {
        return this.inner.getValue();
    }
}
