import { Session } from '@service/session';
import { IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Destroyable } from '@platform/types/life/destroyable';

export class State implements Destroyable<void> {
    protected ref: undefined | (IlcInterface & ChangesDetector);
    protected session: Session | undefined;

    public title: string = '';
    public flags: {
        sde: boolean;
    } = {
        sde: false,
    };
    public states: {
        sde: boolean;
    } = {
        sde: false,
    };

    public bind(ref: IlcInterface & ChangesDetector, session: Session): State {
        this.ref = ref;
        this.session = session;
        ref.env().subscriber.register(
            session.stream.sde.subjects.get().updated.subscribe(() => {
                this.update();
            }),
            session.stream.subjects.get().started.subscribe(() => {
                this.update();
            }),
            session.stream.subjects.get().finished.subscribe(() => {
                this.update();
            }),
        );
        this.update();
        return this;
    }

    public destroy(): Promise<void> {
        this.ref = undefined;
        return Promise.resolve();
    }

    public toggleSde() {
        if (this.session === undefined) {
            return;
        }
        const sde = this.session.stream.sde;
        if (sde.visibility().hidden()) {
            sde.visibility().show();
        } else {
            sde.visibility().hide();
        }
        this.states.sde = !sde.visibility().hidden();
    }

    protected update(): void {
        if (this.session === undefined) {
            return;
        }
        this.flags.sde = this.session.stream.sde.isAvailable();
        const sources = this.session.stream.observe().sources();
        if (sources.length === 0) {
            this.states.sde = false;
            this.title = 'no sources are bound with session';
        } else if (sources.length === 1) {
            this.states.sde = !this.session.stream.sde.visibility().hidden();
            this.title = ((): string => {
                const observe = sources[0].observe;
                const desc = observe.origin.desc();
                return `${desc.major}: ${desc.minor}`;
            })();
        } else {
            const running = sources.filter((s) => s.observer !== undefined).length;
            this.title = `multiple ${sources.length} sources; ${running} running; ${
                sources.length - running
            } stopped`;
        }
        this.safe().updateRefComp();
    }

    protected safe(): {
        updateRefComp(): void;
        unsubscribe(): void;
        error(msg: string): void;
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
        };
    }
}
