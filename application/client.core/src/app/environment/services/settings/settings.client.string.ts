import { LocalField } from '../../controller/settings/field.store';
import { ElementInputStringRef } from '../../../../../../common/settings/field.render';

export class ClientTestStrings extends LocalField<string> {

    private _element: ElementInputStringRef = new ElementInputStringRef({
        placeholder: 'Test Placeholder',
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
            if (state.trim() === '' || (state.length > 5 && state.length < 50)) {
                resolve();
            } else {
                reject(new Error(`Expected 5 < length < 50 chars. Length: ${state.length}`));
            }
        });
    }

    public getElement(): ElementInputStringRef {
        return this._element;
    }

}
