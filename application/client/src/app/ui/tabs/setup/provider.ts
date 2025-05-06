import { SchemeProvider } from '@elements/scheme/provider';
import { Field, FieldDesc, Value } from '@platform/types/bindings';
import { SourceOrigin, LazyFieldDesc } from '@platform/types/bindings';
import { components } from '@service/components';
import { Logger } from '@env/logs';
import {
    LoadingCancelledEvent,
    LoadingDoneEvent,
    LoadingErrorEvent,
    LoadingErrorsEvent,
} from '@platform/types/components';
import { WrappedField } from '@ui/elements/scheme/field';
import { SessionSourceOrigin } from '@service/session/origin';

export class Proivder extends SchemeProvider {
    protected pending: string[] = [];
    protected readonly logger = new Logger(`ObserveSetupProivder`);
    protected readonly values: Map<string, Value> = new Map();
    protected fields: string[] = [];

    constructor(protected readonly origin: SessionSourceOrigin, protected readonly target: string) {
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

    public override get(): Promise<FieldDesc[]> {
        this.pending.length === 0 && components.abort(this.pending);
        this.pending = [];
        return components
            .getOptions(this.origin.getDef(), [this.target])
            .then((map: Map<string, FieldDesc[]>) => {
                const fields = map.get(this.target);
                if (!fields) {
                    return Promise.resolve([]);
                }
                this.fields = fields.map((field) => new WrappedField(field).id);
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

    public override setValue(uuid: string, value: Value): void {
        if (!this.fields.includes(uuid)) {
            this.logger.error(`Field ${uuid} doesn't belong to current provider`);
            return;
        }
        this.values.set(uuid, value);
        const fields: Field[] = [];
        this.values.forEach((value, id) => {
            fields.push({ id, value });
        });
        components
            .validate(this.origin.getDef(), this.target, fields)
            .then((errs: Map<string, string>) => {
                // Always forward errors info, even no errors
                this.subjects.get().error.emit(errs);
            })
            .catch((err: Error) => {
                this.logger.error(`Fail to validate settings: ${err.message}`);
            });
    }

    public override destroy(): Promise<void> {
        this.unsubscribe();
        this.subjects.destroy();
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
            this.subjects.get().loaded.emit(field);
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
        errors.size > 0 && this.subjects.get().error.emit(errors);
    }
    protected onLoadingErrors(event: LoadingErrorsEvent) {
        const errors = new Map();
        event.errors.forEach((error) => {
            if (!this.pending.includes(error.id)) {
                return;
            }
            errors.set(error.id, error.err);
        });
        errors.size > 0 && this.subjects.get().error.emit(errors);
    }
    protected onLoadingCancelled(event: LoadingCancelledEvent) {}
}
