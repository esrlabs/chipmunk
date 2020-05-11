import { Field, IEntry } from '../../../../common/settings/field.store';
import { ElementInputStringRef } from '../../../../common/settings/field.render';

export class GeneralUpdateTestStrings extends Field<string> {

    private _element: ElementInputStringRef = new ElementInputStringRef({
        placeholder: 'Test Placeholder',
        label: 'Test Label',
    });

    public getDefault(): Promise<string> {
        return new Promise((resolve) => {
            resolve('');
        });
    }

    public validate(state: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (typeof state !== 'string') {
                return reject(new Error(`This field is required`));
            }
            if (state.trim() === "" || /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(state)) {
                resolve();
            } else {
                reject(new Error(`Wrong format of email`));
            }
        });
    }

    public getElement(): ElementInputStringRef {
        return this._element;
    }

}
