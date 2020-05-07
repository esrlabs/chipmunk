import { ISettingsField } from './field';

export interface IUpdates {
    check: ISettingsField<boolean>;
    download: ISettingsField<boolean>;
}
