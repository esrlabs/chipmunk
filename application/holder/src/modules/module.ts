import { scope } from 'platform/env/scope';
import { Instance as Logger } from 'platform/env/logger';
import { Subscriber } from 'platform/env/subscription';

export abstract class Module extends Subscriber {
    public logger: Logger;

    constructor() {
        super();
        this.logger = scope.getLogger(`mod: ${this.getName()}`);
        this.init = this.init.bind(this);
    }

    public abstract getName(): string;

    public init(): Promise<void> {
        return Promise.resolve();
    }
}
