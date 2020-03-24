
import { IHistory } from '../../interfaces/interface.plugins';

export interface IPluginsNotificationUpgrade {
    name: string;
    versions: IHistory[];
}

export class PluginsNotificationUpgrade {
    public static signature: string = 'PluginsNotificationUpgrade';
    public signature: string = PluginsNotificationUpgrade.signature;

    public name: string;
    public versions: IHistory[];

    constructor(params: IPluginsNotificationUpgrade) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for Plugin message`);
        }
        if (typeof params.name !== 'string' || params.name.trim() === '') {
            throw new Error(`Field "name" should be string`);
        }
        if (!(params.versions instanceof Array)) {
            throw new Error(`Field "versions" should be Array<IHistory>`);
        }
        this.name = params.name;
        this.versions = params.versions;
    }
}
