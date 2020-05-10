import { Field, IEntry } from '../../../../common/settings/field.store';
import { ElementInputNumberRef } from '../../../../common/settings/field.render';

export class GeneralUpdateTestNumbers extends Field<boolean> {

    private _element: ElementInputNumberRef = new ElementInputNumberRef({
        placeholder: 'Test Placeholder',
        label: 'Test Label',
        min: 10,
        max: 100,
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

    public getElement(): ElementInputNumberRef {
        return this._element;
    }

}
