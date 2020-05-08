import { Field } from '../../../../common/settings/field.store';
import { ElementCheckbox } from '../../../../common/settings/field.render';

export class GeneralUpdateApp extends Field<boolean> {

    private _element: ElementCheckbox = new ElementCheckbox();

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

    public getElement(): Promise<ElementCheckbox> {
        return new Promise((resolve) => {
            if (this._element === undefined) {
                this._element = new ElementCheckbox();
            }
            resolve(this._element);
        });
    }

}
