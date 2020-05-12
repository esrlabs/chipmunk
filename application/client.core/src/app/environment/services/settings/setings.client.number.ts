import { Field, IEntry } from '../../../../../../common/settings/field.store';
import { ElementInputNumberRef } from '../../../../../../common/settings/field.render';

export class ClientTestNumbers extends Field<number> {

    private _element: ElementInputNumberRef = new ElementInputNumberRef({
        placeholder: 'Test Placeholder',
        label: 'Test Label',
        min: 10,
        max: 100,
    });

    public getDefault(): Promise<number> {
        return new Promise((resolve) => {
            resolve(this._element.min);
        });
    }

    public validate(state: number): Promise<void> {
        return new Promise((resolve, reject) => {
            if (state === undefined) {
                return undefined;
            }
            if (typeof state !== 'number') {
                return reject(new Error(`Expecting number type`));
            }
            if (state < this._element.min || state > this._element.max) {
                reject(new Error(`Value should be ${this._element.min} < and > ${this._element.max}`));
            } else {
                resolve();
            }
        });
    }

    public getElement(): ElementInputNumberRef {
        return this._element;
    }

}
