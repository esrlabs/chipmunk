import { Field, IEntry } from '../../../../common/settings/field.store';
import { ElementInputStringRef } from '../../../../common/settings/field.render';

export class StandardInput extends Field<string> {

    private _element: ElementInputStringRef = new ElementInputStringRef({ placeholder: '' });
    private _alias: string = '';

    constructor(entry: IEntry, alias: string) {
        super(entry);
        this._alias = alias;
    }
    public getDefault(): Promise<string> {
        return new Promise((resolve) => {
            resolve('');
        });
    }

    public validate(state: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (typeof state !== 'string') {
                return reject(new Error(`Expecting string type for "${this._alias}"`));
            }
            resolve();
        });
    }

    public getElement(): ElementInputStringRef {
        return this._element;
    }

}
