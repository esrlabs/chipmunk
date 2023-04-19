import { Session } from '@service/session';
import { IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { ObserveOperation } from '@service/session/dependencies/stream';
import { SourceDescription } from '@platform/types/observe';
import { Destroyable } from '@platform/types/life/destroyable';
import { Notification } from '@ui/service/notifications';

export class State implements Destroyable<void> {
    protected ref: undefined | (IlcInterface & ChangesDetector);
    protected session: Session | undefined;

    public sources: ObserveOperation[] = [];
    public selected: ObserveOperation | undefined;

    public progress: boolean = false;
    public hidden: boolean = false;

    public bind(ref: IlcInterface & ChangesDetector, session: Session): State {
        this.ref = ref;
        this.session = session;
        ref.env().subscriber.register(
            session.stream.sde.subjects.get().updated.subscribe(() => {
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
        return this.selected === undefined
            ? false
            : source.asSource().uuid === this.selected.asSource().uuid;
    }

    public desc(source: ObserveOperation): SourceDescription {
        const desc = source.asSource().desc();
        if (desc instanceof Error) {
            this.safe().error(`Fail to get DataSource description: ${desc.message}`);
            return {
                major: 'unknown',
                minor: '',
                icon: '',
                type: '',
                state: {
                    stopped: '',
                    running: '',
                },
            };
        }
        return desc;
    }

    public send(data: string): Promise<void> {
        if (this.selected === undefined) {
            return Promise.resolve();
        }
        this.progress = true;
        this.safe().updateRefComp();
        return this.selected
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
        this.selected = source;
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
        this.hidden = sde.visibility().hidden();
        this.sources = sde.get();
        if (this.selected !== undefined) {
            this.sources.find((o) => o.asSource().uuid === this.selected?.asSource().uuid) ===
                undefined && (this.selected = undefined);
        }
        this.select(
            this.selected !== undefined
                ? this.selected
                : this.sources.length > 0
                ? this.sources[0]
                : undefined,
        );
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
