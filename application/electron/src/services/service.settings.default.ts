// tslint:disable: max-classes-per-file

import { IService } from '../interfaces/interface.service';
import { Entry, Field, getEntryKey, ESettingType } from '../../../common/settings/field';

import ServicePath from './service.paths';

import ServiceSettings from './service.settings';

class CoreIndexHtml extends Field<string> {

    public getDefault(): string {
        return `client/index.html`;
    }

    public getOptions(): string[] {
        return [];
    }

    public getValidateErrorMessage(path: string): Error | undefined {
        const clientPath = ServicePath.resoveRootFolder(path);
        if (!ServicePath.isExist(clientPath)) {
            return new Error(`Cannot find client on path "${clientPath}"`);
        }
        return undefined;
    }

}

export const CSettings = {
    client: {
        index: new CoreIndexHtml({ key: 'index', name: 'index', desc: 'HTML Index file', path: 'core', type: ESettingType.hidden }),
    },
};

/**
 * @class ServiceConfigDefault
 * @description Setup default settings
 */

class ServiceConfigDefault implements IService {

    public init(): Promise<void> {
        return new Promise((resolve) => {
            ServiceSettings.register(new Entry({ key: 'core', name: 'Core', desc: 'Settings of core', path: '', type: ESettingType.hidden }));
            ServiceSettings.register(CSettings.client.index);
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceConfigDefault';
    }

}

export default (new ServiceConfigDefault());
