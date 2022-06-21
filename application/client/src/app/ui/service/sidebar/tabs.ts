import { ITab } from '@elements/tabs/service';
import { DEFAULTS } from './register';

export class Tabs {
    private _available: Array<ITab & { default: boolean }> = [];

    constructor() {
        this._available = DEFAULTS.map((defaultView) => {
            return {
                uuid: defaultView.uuid,
                name: defaultView.name,
                active: false,
                closable: defaultView.closable,
                content: defaultView.content,
                default: defaultView.default,
            };
        });
    }

    public all(): ITab[] {
        return this._available;
    }

    public defaults(): ITab[] {
        return this._available.filter((tab) => tab.default);
    }

    public get(uuid: string): ITab | undefined {
        return this._available.find((tab: ITab) => {
            return tab.uuid === uuid;
        });
    }

    public visible(uuid: string): boolean {
        let result: boolean = false;
        DEFAULTS.forEach((defaultView) => {
            if (result) {
                return;
            }
            if (defaultView.default === true && defaultView.uuid === uuid) {
                result = true;
            }
        });
        return result;
    }
}
