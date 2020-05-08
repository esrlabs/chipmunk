import { Field } from '../../../../common/settings/field';

export class GeneralUpdatePlugins extends Field<boolean> {

    public getDefault(): boolean {
        return true;
    }

    public getOptions(): boolean[] {
        return [];
    }

    public getValidateErrorMessage(state: boolean): Error | undefined {
        if (typeof state !== 'boolean') {
            return new Error(`Expecting boolean type for GeneralUpdatePlugins`);
        }
        return undefined;
    }

}
