import { ConfigSchema } from '@platform/types/plugins';

export class State {
    public schemas: ConfigSchema[] = [];

    public reload(schemas: ConfigSchema[]) {
        this.schemas = schemas;
    }
}
