import { Logger } from '@platform/log';
import { scope } from '@platform/env/scope';
import { Definition } from './definition';

export class Definitions {
    static UUID = 'history_definitions_holder';
    protected readonly definitions: Map<string, Definition> = new Map();
    protected readonly logger: Logger;

    constructor() {
        this.logger = scope.getLogger(`Definitions holder (history)`);
    }

    public add(definition: Definition): void {
        this.definitions.set(definition.uuid, definition);
    }

    public list(): Definition[] {
        return Array.from(this.definitions.values());
    }
}
