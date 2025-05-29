import { SchemeProvider } from '@elements/scheme/provider';
import { Field, FieldDesc, Value } from '@platform/types/bindings';
import { Logger } from '@env/logs';

export class Provider extends SchemeProvider {
    protected pending: string[] = [];
    protected readonly logger = new Logger(`ObserveSetupProivder`);
    protected readonly values: Map<string, Value> = new Map();
    protected fields: string[] = [];

    constructor() {
        super();
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
}
