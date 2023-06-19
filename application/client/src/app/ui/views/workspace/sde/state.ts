import { Session } from '@service/session';
import { IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { ObserveOperation } from '@service/session/dependencies/stream';
import { IOriginDetails } from '@platform/types/observe';
import { Destroyable } from '@platform/types/life/destroyable';
import { Notification } from '@ui/service/notifications';
import { getSourceColor } from '@ui/styles/colors';

export class State implements Destroyable<void> {
    protected ref: undefined | (IlcInterface & ChangesDetector);
    protected session!: Session;

    public operations: ObserveOperation[] = [];
    public progress: boolean = false;
    public hidden: boolean = false;
    public selected: ObserveOperation | undefined;

    public bind(ref: IlcInterface & ChangesDetector, session: Session): State {
        this.ref = ref;
        this.session = session;
        ref.env().subscriber.register(
            session.stream.sde.subjects.get().updated.subscribe(() => {
                this.update();
            }),
            session.stream.sde.subjects.get().selected.subscribe(() => {
                this.update();
            }),
            session.stream.sde.subjects.get().visibility.subscribe(() => {
                if (this.session === undefined) {
                    return;
                }
                const sde = this.session.stream.sde;
                this.hidden = sde.visibility().hidden();
                this.safe().updateRefComp();
            }),
        );
        this.update();
        return this;
    }

    public destroy(): Promise<void> {
        this.ref = undefined;
        return Promise.resolve();
    }

    public isSelected(source: ObserveOperation): boolean {
        const selection = this.session.stream.sde.selecting().get();
        return selection === undefined ? false : selection.uuid === source.uuid;
    }

    public getSourceColor(source: ObserveOperation): string {
        const id = this.session.stream.observe().descriptions.id(source.uuid);
        return id === undefined ? '' : getSourceColor(id);
    }

    public desc(source: ObserveOperation): IOriginDetails {
        return source.asOrigin().desc();
    }

    public send(data: string): Promise<void> {
        const selected = this.session.stream.sde.selecting().get();
        if (selected === undefined) {
            return Promise.resolve();
        }
        this.progress = true;
        this.safe().updateRefComp();
        return selected
            .send()
            .text(data)
            .then(() => undefined)
            .catch((err: Error) => {
                this.safe().notify(err.message);
            })
            .finally(() => {
                this.progress = false;
                this.safe().updateRefComp();
            });
    }

    public select(source: ObserveOperation | undefined): void {
        this.session.stream.sde.selecting().select(source === undefined ? undefined : source.uuid);
        this.selected = this.session.stream.sde.selecting().get();
        if (this.selected !== undefined) {
            this.progress = this.selected.getSdeTasksCount() > 0;
        }
        this.safe().updateRefComp();
    }

    protected update(): void {
        if (this.session === undefined) {
            return;
        }
        const sde = this.session.stream.sde;
        this.selected = sde.selecting().get();
        this.hidden = sde.visibility().hidden();
        this.operations = sde.get();
        if (this.selected !== undefined) {
            this.progress = this.selected.getSdeTasksCount() > 0;
        }
        this.safe().updateRefComp();
    }

    protected safe(): {
        updateRefComp(): void;
        unsubscribe(): void;
        error(msg: string): void;
        notify(err: string): void;
    } {
        return {
            updateRefComp: (): void => {
                if (this.ref === undefined) {
                    return;
                }
                this.ref.detectChanges();
            },
            unsubscribe: (): void => {
                if (this.ref === undefined) {
                    return;
                }
                this.ref.env().subscriber.unsubscribe();
            },
            error: (msg: string): void => {
                if (this.ref === undefined) {
                    return;
                }
                this.ref.log().error(msg);
            },
            notify: (err: string): void => {
                if (this.ref === undefined) {
                    return;
                }
                this.ref.log().warn(err);
                this.ref.ilc().services.ui.notifications.notify(
                    new Notification({
                        message: err.replace('{"Sde":"', '').replace('"}', ''),
                        actions: [],
                    }),
                );
            },
        };
    }
}
