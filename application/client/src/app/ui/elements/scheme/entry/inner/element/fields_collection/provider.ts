import { SchemeProvider } from '@elements/scheme/provider';
import { Field, FieldDesc, Value } from '@platform/types/bindings';
import { Logger } from '@env/logs';
import { unique } from '@platform/env/sequence';

export class Provider extends SchemeProvider {
    protected pending: string[] = [];
    protected readonly logger = new Logger(`ObserveSetupProivder`);
    protected readonly values: Map<string, Value> = new Map();
    protected fields: string[] = [];

    constructor() {
        super(unique());
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

    public override isValid(): boolean {
        // This is dummy provider to broadcase event. No needs for validation
        return true;
    }

    public override getFields(): Field[] {
        const fields: Field[] = [];
        this.values.forEach((value, id) => {
            fields.push({ id, value });
        });
        return fields;
    }
}
