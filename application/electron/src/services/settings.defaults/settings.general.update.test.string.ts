import { Field, IEntry } from '../../../../common/settings/field.store';
import { ElementInputStringRef } from '../../../../common/settings/field.render';

export class GeneralUpdateTestStrings extends Field<boolean> {

    private _element: ElementInputStringRef = new ElementInputStringRef({
        placeholder: 'Test Placeholder',
        label: 'Test Label',
    });

    public getDefault(): Promise<boolean> {
        return new Promise((resolve) => {
            resolve(true);
        });
    }

    public validate(state: boolean): Promise<void> {
        return new Promise((resolve, reject) => {
            if (typeof state !== 'boolean') {
                return reject(new Error(`Expecting boolean type for GeneralUpdateApp`));
            }
            resolve();
        });
    }

    public getElement(): ElementInputStringRef {
        return this._element;
    }

}
