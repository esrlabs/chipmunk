import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { ui } from '@register/services';
import { ilc, Emitter } from '@service/ilc';
import { IComponentDesc } from '@elements/containers/dynamic/component';
import { unique } from '@platform/env/sequence';
import { Once } from '@platform/env/togglers';

export { IComponentDesc };
export interface IMenuItem {
    id?: string;
    caption?: string;
    handler?: () => void;
    disabled?: boolean;
    shortcut?: string;
}

export interface IMenu {
    id?: string;
    component?: IComponentDesc;
    items?: IMenuItem[];
    after?: () => void;
    x: number;
    y: number;
}

@SetupService(ui['contextmenu'])
export class Service extends Implementation {
    private _emitter!: Emitter;

    public override ready(): Promise<void> {
        this._emitter = ilc.emitter(this.getName(), this.log());
        return Promise.resolve();
    }

    public show(menu: IMenu): Once {
        const uuid = menu.id !== undefined ? menu.id : unique();
        menu.id = uuid;
        this._emitter.ui.contextmenu.open(menu);
        return new Once(
            `contextmenu: ${uuid}`,
            () => {
                this._emitter.ui.contextmenu.close();
            },
            uuid,
        );
    }

    public remove(): void {
        this._emitter.ui.contextmenu.close();
    }
}
export interface Service extends Interface {}
export const contextmenu = register(new Service());
