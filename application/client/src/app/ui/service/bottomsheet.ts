import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { ui } from '@register/services';
import { unique } from '@platform/env/sequence';
import { Once } from '@platform/env/togglers';
import { Subject } from '@platform/env/subscription';

export interface Options {
    closed?: () => void;
    position?: 'top' | 'bottom';
}

@SetupService(ui['bottomsheet'])
export class Service extends Implementation {
    public open: Subject<{ uuid: string; component: unknown; data: unknown; options?: Options }> =
        new Subject();
    public close: Subject<string> = new Subject();

    public override ready(): Promise<void> {
        return Promise.resolve();
    }

    public show(component: unknown, data: unknown, options?: Options): Once {
        const uuid = unique();
        this.open.emit({
            component,
            data,
            uuid,
            options,
        });
        return new Once(
            `bottomsheet: ${uuid}`,
            () => {
                this.close.emit(uuid);
            },
            uuid,
        );
    }

    public remove(uuid: string): void {
        this.close.emit(uuid);
    }
}
export interface Service extends Interface {}
export const bottomsheet = register(new Service());
