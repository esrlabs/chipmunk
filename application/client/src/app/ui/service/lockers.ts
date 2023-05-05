import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { ui } from '@register/services';
import { popup, PopupOptions, Popup } from '@ui/service/popup';
import { components } from '@env/decorators/initial';
import { Locker } from './lokers/locker';
import { Level } from './notification/index';
import { Vertical, Horizontal } from '@ui/service/popup';
import { Subject } from '@platform/env/subscription';

export { Locker, Level };

@SetupService(ui['lockers'])
export class Service extends Implementation {
    public unbound: Subject<Locker> = new Subject<Locker>();

    protected lockers: Map<string, { locker: Locker; popup: Popup | undefined }> = new Map();

    public override destroy(): Promise<void> {
        this.lockers.forEach((stored) => {
            if (stored.popup !== undefined) {
                stored.popup.close();
            }
        });
        this.lockers.clear();
        this.unbound.destroy();
        return Promise.resolve();
    }

    public lock(locker: Locker, options: PopupOptions): { locker: Locker; popup: Popup } {
        const created = {
            locker,
            popup: popup.open(
                Object.assign(options, {
                    component: {
                        factory: components.get('app-dialogs-locker-message'),
                        inputs: {
                            locker,
                        },
                    },
                    position: {
                        vertical: Vertical.center,
                        horizontal: Horizontal.center,
                    },
                    width: 350,
                }),
            ),
        };
        this.action().add(created.locker, created.popup);
        return created;
    }

    public get(group: string): Locker[] {
        return Array.from(this.lockers.values())
            .filter((s) => s.popup === undefined && s.locker.group === group)
            .map((s) => s.locker);
    }

    public progress(caption: string): () => void {
        const { locker: _, popup } = lockers.lock(
            new Locker(true, caption).set().type(Level.progress).end(),
            {
                closable: false,
            },
        );
        return () => {
            popup.close();
        };
    }

    protected action(): {
        add(locker: Locker, popup: Popup): void;
        unbound(group: string): void;
    } {
        return {
            add: (locker: Locker, popup: Popup): void => {
                this.lockers.set(locker.uuid, { locker, popup });
                const subscription = popup.subjects.get().closed.subscribe(() => {
                    subscription.destroy();
                    this.action().unbound(locker.uuid);
                });
            },
            unbound: (uuid: string): void => {
                const stored = this.lockers.get(uuid);
                if (stored === undefined) {
                    return;
                }
                if ([Level.error, Level.warning].includes(stored.locker.type)) {
                    stored.popup = undefined;
                    this.lockers.set(uuid, stored);
                } else {
                    this.lockers.delete(uuid);
                }
                this.unbound.emit(stored.locker);
            },
        };
    }
}
export interface Service extends Interface {}
export const lockers = register(new Service());
