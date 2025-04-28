import { SchemeProvider } from '@elements/scheme/provider';
import { FieldDesc, StaticFieldDesc } from '@platform/types/bindings';
import { SourceOrigin, Ident, LazyFieldDesc } from '@platform/types/bindings';
import { components } from '@service/components';
import { Logger } from '@env/logs';
import {
    LoadingCancelledEvent,
    LoadingDoneEvent,
    LoadingErrorEvent,
    LoadingErrorsEvent,
} from '@platform/types/components';
import { Subscriber, Subject, Subjects } from '@platform/env/subscription';

export class Proivder extends SchemeProvider {
    protected pending: string[] = [];
    protected readonly logger = new Logger(`ObserveSetupProivder`);
    protected readonly subs: Subjects<{
        loaded: Subject<StaticFieldDesc>;
        error: Subject<Map<string, string>>;
    }> = new Subjects({
        loaded: new Subject(),
        error: new Subject(),
    });
    constructor(protected readonly origin: SourceOrigin, protected readonly target: string) {
        super();
        this.register(
            components.subjects.get().LoadingDone.subscribe(this.onLoadingDone.bind(this)),
            components.subjects.get().LoadingError.subscribe(this.onLoadingError.bind(this)),
            components.subjects.get().LoadingErrors.subscribe(this.onLoadingErrors.bind(this)),
            components.subjects
                .get()
                .LoadingCancelled.subscribe(this.onLoadingCancelled.bind(this)),
        );
    }

    public override subjects(): Subjects<{
        loaded: Subject<StaticFieldDesc>;
        error: Subject<Map<string, string>>;
    }> {
        return this.subs;
    }
    public override get(): Promise<FieldDesc[]> {
        this.pending.length === 0 && components.abort(this.pending);
        this.pending = [];
        return components
            .getOptions(this.origin, [this.target])
            .then((map: Map<string, FieldDesc[]>) => {
                const fields = map.get(this.target);
                if (!fields) {
                    return Promise.resolve([]);
                }
                this.pending = fields
                    .map((field: FieldDesc) => {
                        const lazy = field as { Lazy: LazyFieldDesc };
                        if (lazy.Lazy) {
                            return lazy.Lazy.id;
                        } else {
                            return undefined;
                        }
                    })
                    .filter((id) => id !== undefined);
                return Promise.resolve(fields === undefined ? [] : fields);
            });
    }

    public override destroy(): Promise<void> {
        this.unsubscribe();
        this.subs.destroy();
        if (this.pending.length === 0) {
            return Promise.resolve();
        } else {
            return components.abort(this.pending).catch((err: Error) => {
                this.logger.error(`Fail to abort loading of pending fields: ${err.message}`);
            });
        }
    }

    protected onLoadingDone(event: LoadingDoneEvent) {
        event.fields.forEach((field) => {
            if (!this.pending.includes(field.id)) {
                return;
            }
            this.subs.get().loaded.emit(field);
        });
    }
    protected onLoadingError(event: LoadingErrorEvent) {
        const errors = new Map();
        event.fields.forEach((id) => {
            if (!this.pending.includes(id)) {
                return;
            }
            errors.set(id, event.error);
        });
        errors.size > 0 && this.subs.get().error.emit(errors);
    }
    protected onLoadingErrors(event: LoadingErrorsEvent) {
        const errors = new Map();
        event.errors.forEach((error) => {
            if (!this.pending.includes(error.id)) {
                return;
            }
            errors.set(error.id, error.err);
        });
        errors.size > 0 && this.subs.get().error.emit(errors);
    }
    protected onLoadingCancelled(event: LoadingCancelledEvent) {}
}
