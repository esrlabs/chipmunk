import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { ui } from '@register/services';
import { ilc, Emitter } from '@service/ilc';

@SetupService(ui['layout'])
export class Service extends Implementation {
    private _emitter!: Emitter;

    public override ready(): Promise<void> {
        this._emitter = ilc.emitter(this.getName(), this.log());
        return Promise.resolve();
    }

    public sidebar(): {
        min: () => void;
        max: () => void;
    } {
        const emitter = this._emitter;
        return {
            min(): void {
                emitter.ui.sidebar.min();
            },
            max(): void {
                emitter.ui.sidebar.max();
            },
        };
    }

    public toolbar(): {
        min: () => void;
        max: () => void;
    } {
        const emitter = this._emitter;
        return {
            min(): void {
                emitter.ui.toolbar.min();
            },
            max(): void {
                emitter.ui.toolbar.max();
            },
        };
    }
}

export interface Service extends Interface {}
export const layout = register(new Service());
