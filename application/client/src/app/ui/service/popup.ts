import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { ui } from '@register/services';
import { ilc, Emitter } from '@service/ilc';
import { IComponentDesc } from '@elements/containers/dynamic/component';
import { Popup, Options, PopupOptions, Vertical, Horizontal } from './popup/popup';

export { IComponentDesc, Popup, Vertical, Horizontal, PopupOptions, Options };

@SetupService(ui['popup'])
export class Service extends Implementation {
    private _emitter!: Emitter;
    private _count: number = 0;

    public override ready(): Promise<void> {
        this._emitter = ilc.emitter(this.getName(), this.log());
        return Promise.resolve();
    }

    public open(options: Options): Popup {
        const popup = new Popup(options, this.close.bind(this));
        this._emitter.ui.popup.open(popup);
        return popup;
    }

    public close(uuid: string): void {
        this._emitter.ui.popup.close(uuid);
    }

    public setCount(count: number) {
        this._count = count;
    }

    public getCount(): number {
        return this._count;
    }
}
export interface Service extends Interface {}
export const popup = register(new Service());
