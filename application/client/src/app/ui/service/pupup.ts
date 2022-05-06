import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { ui } from '@register/services';
import { ilc, Emitter } from '@service/ilc';
import { IComponentDesc } from '@elements/containers/dynamic/component';
import { unique } from '@platform/env/sequence';
import { Once } from '@platform/env/togglers';

export { IComponentDesc };

export type Callback = () => void;
/**
 * Options for client popup window
 */
export interface IOptions {
    /**
     * @property {boolean} closable - shows or hide close-button in top-right corner: true - show; false - hide
     */
    closable?: boolean;
    /**
     * @property {number} width - default width of popup in rem
     */
    width?: number;
    /**
     * @property {boolean} minimalistic - with TRUE shows only container, without title and border; default - FALSE
     */
    minimalistic?: boolean;
    /**
     * @depricated
     * this property comes from INotifications and should be removed from popup interfaces
     */
    once?: boolean;
}
/**
 * Description of buttons in popup (bottom area)
 */
export interface IButton {
    /**
     * @property {string} caption - caption of button
     */
    caption: string;
    /**
     * @property {(...args: any[]) => any} handler - callback on click event
     */
    handler: (...args: any[]) => any;
}
/**
 * Client popup window
 */
export interface IPopup {
    /**
     * @property {string} id - id of popup window. Will be used for removing popup
     */
    id?: string;
    /**
     * @property {string} caption - caption of popup
     */
    caption: string;
    /**
     * @property {string} message - string message to be shown in popup. Could be used
     * if developer don't need to show complex content and needs to show just some kind
     * of message
     */
    message?: string;
    /**
     * @property {IComponentDesc} component - description of Angular component, which
     * will be used as content for popup window.
     * Should be used to render complex content with some controlls for example.
     */
    component?: IComponentDesc;
    /**
     * @property {IButton[]} buttons - buttons, which will be shown on the bottom of popup window
     */
    buttons?: IButton[];
    /**
     * @property {IOptions} options - options of popup
     */
    options?: IOptions;
    /**
     * Callback would be called after popup is rendered
     */
    afterOpen?: Callback;
    /**
     * Callback would be called before popup would be removed
     */
    beforeClose?: Callback;
}

@SetupService(ui['popup'])
export class Service extends Implementation {
    private _emitter!: Emitter;

    public override ready(): Promise<void> {
        this._emitter = ilc.emitter(this.getName(), this.log());
        return Promise.resolve();
    }

    public open(desc: IPopup): Once {
        const uuid = desc.id !== undefined ? desc.id : unique();
        desc.id = uuid;
        this._emitter.ui.popup.open(desc);
        return new Once(
            `popup: ${uuid}`,
            () => {
                if (this._emitter === undefined) {
                    throw new Error(
                        `Service "${this.getName()}" isn't inted. Emitter isn't available.`,
                    );
                }
                this._emitter.ui.popup.close(uuid);
            },
            uuid,
        );
    }

    public close(uuid: string): void {
        this._emitter.ui.popup.close(uuid);
    }
}
export interface Service extends Interface {}
export const popup = register(new Service());
