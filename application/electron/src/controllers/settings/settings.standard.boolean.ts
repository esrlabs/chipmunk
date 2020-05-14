import { Field, IEntry } from '../../../../common/settings/field.store';
import { ElementCheckboxRef } from '../../../../common/settings/field.render';

export class StandardBoolean extends Field<boolean> {

    private _element: ElementCheckboxRef = new ElementCheckboxRef();
    private _alias: string = '';

    constructor(entry: IEntry, alias: string) {
        super(entry);
        this._alias = alias;
    }
    public getDefault(): Promise<boolean> {
        return new Promise((resolve) => {
            resolve(true);
        });
    }

    public validate(state: boolean): Promise<void> {
        return new Promise((resolve, reject) => {
            if (typeof state !== 'boolean') {
                return reject(new Error(`Expecting boolean type for "${this._alias}"`));
            }
            resolve();
        });
    }

    public getElement(): ElementCheckboxRef {
        return this._element;
    }

}
