import { ITab } from '@elements/tabs/service';
import { DEFAULTS } from './register';

export class Tabs {
    private _available: ITab[] = [];
    private _inputs: { [key: string]: any } = {};

    constructor() {
        this._available = DEFAULTS.map((defaultView) => {
            return {
                uuid: defaultView.uuid,
                name: defaultView.name,
                active: false,
                tabCaptionInjection:
                    defaultView.tabCaptionInjection === undefined
                        ? undefined
                        : {
                              factory: defaultView.tabCaptionInjection,
                              inputs: Object.assign(defaultView.inputs, this._inputs),
                          },
                closable: defaultView.closable,
                content: {
                    factory: defaultView.factory,
                    inputs: Object.assign(defaultView.inputs, this._inputs),
                },
            };
        });
    }

    public all(): ITab[] {
        return this._available;
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
