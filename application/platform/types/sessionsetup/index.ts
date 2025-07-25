import { IJob } from '../observe';
import { SessionSetup } from '../bindings';

export class SessionSetupHolder {
    constructor(protected readonly options: SessionSetup) {}

    public asJob(): IJob {
        return {
            name: this.options.source.uuid,
            desc: this.options.source.uuid,
            icon: undefined,
        };
    }
}
