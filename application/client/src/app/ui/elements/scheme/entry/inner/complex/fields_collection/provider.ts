import { SchemeProvider } from '@elements/scheme/provider';
import { Field, FieldDesc, Value } from '@platform/types/bindings';
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

    constructor() {
        super();
        // this.register(
        //     components.subjects.get().LoadingDone.subscribe(this.onLoadingDone.bind(this)),
        //     components.subjects.get().LoadingError.subscribe(this.onLoadingError.bind(this)),
        //     components.subjects.get().LoadingErrors.subscribe(this.onLoadingErrors.bind(this)),
        // );
    }

    public override get(): Promise<FieldDesc[]> {
        return Promise.resolve([]);
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
    }

    public override destroy(): Promise<void> {
        this.unsubscribe();
        this.subjects.destroy();
        return Promise.resolve();
    }

    protected onLoadingDone(event: LoadingDoneEvent) {}

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
