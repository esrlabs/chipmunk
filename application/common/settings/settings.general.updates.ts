import { ISettingsField } from './field';

export interface IGeneralUpdates {
    check: ISettingsField<boolean>;
    download: ISettingsField<boolean>;
}
