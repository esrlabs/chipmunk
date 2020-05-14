import { IService } from '../../interfaces/interface.service';
import { Entry, ESettingType } from '../../controller/settings/field.store';
import { ClientTestStrings } from './settings.client.string';
import { ClientTestNumbers } from './setings.client.number';

import SettingsService from '../service.settings';

import * as Toolkit from 'chipmunk.client.toolkit';

export const CSettings = {
    client: {
        strings: new ClientTestStrings({ key: 'strings', name: 'Strings', desc: 'Test of string setting', path: 'client', type: ESettingType.standard, value: '' }),
        numbers: new ClientTestNumbers({ key: 'numbers', name: 'Numbers', desc: 'Test of number setting', path: 'client', type: ESettingType.standard, value: 25 }),
    },
    general: {
        client: {
            strings: new ClientTestStrings({ key: 'strings', name: 'Strings G', desc: 'Test of string setting', path: 'general.client', type: ESettingType.standard, value: 'something' }),
            numbers: new ClientTestNumbers({ key: 'numbers', name: 'Numbers G', desc: 'Test of number setting', path: 'general.client', type: ESettingType.standard, value: 34 }),
        }
    },
};

export class SettingsDefaultsService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('SettingsDefaultsService');

    constructor() {
    }

    public init(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
            /*
            Toolkit.sequences([
                SettingsService.register.bind(SettingsService, new Entry({ key: 'client', name: 'Core', desc: 'Settings of client', path: '', type: ESettingType.standard })),
                SettingsService.register.bind(SettingsService, new Entry({ key: 'general', name: 'General', desc: 'General setting of chipmunk', path: '', type: ESettingType.standard })),
                SettingsService.register.bind(SettingsService, new Entry({ key: 'client', name: 'Client', desc: 'Client settings', path: 'general', type: ESettingType.standard })),
            ]).catch((structErr: Error) => {
                this._logger.error(`Fail setup setting due error: ${structErr.message}`);
            }).finally(() => {
                Promise.all([
                    SettingsService.register(CSettings.client.strings).catch((regErr: Error) => {
                        this._logger.error(regErr.message);
                    }),
                    SettingsService.register(CSettings.client.numbers).catch((regErr: Error) => {
                        this._logger.error(regErr.message);
                    }),
                    SettingsService.register(CSettings.general.client.strings).catch((regErr: Error) => {
                        this._logger.error(regErr.message);
                    }),
                    SettingsService.register(CSettings.general.client.numbers).catch((regErr: Error) => {
                        this._logger.error(regErr.message);
                    }),
                ]).catch((error: Error) => {
                    this._logger.error(`Fail setup setting due error: ${error.message}`);
                }).finally(() => {
                    resolve();
                });
            });
            */
        });
    }

    public getName(): string {
        return 'SettingsDefaultsService';
    }

    public destroy() { }

}

export default (new SettingsDefaultsService());
