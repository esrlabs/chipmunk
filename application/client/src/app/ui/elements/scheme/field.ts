import { FieldDesc, LazyFieldDesc, StaticFieldDesc } from '@platform/types/bindings';

export class WrappedField {
    public id: string;
    public name: string;
    public desc: string;
    public binding: string | undefined;
    public pending: LazyFieldDesc | undefined;
    public loaded: StaticFieldDesc | undefined;

    constructor(field: FieldDesc) {
        const pending = (field as { Lazy: LazyFieldDesc }).Lazy;
        const loaded = (field as { Static: StaticFieldDesc }).Static;
        this.pending = pending;
        this.loaded = loaded;
        if (pending) {
            this.id = pending.id;
            this.desc = pending.desc;
            this.name = pending.name;
            this.binding = !pending.binding ? undefined : pending.binding;
        } else if (loaded) {
            this.id = loaded.id;
            this.desc = loaded.desc;
            this.name = loaded.name;
            this.binding = !loaded.binding ? undefined : loaded.binding;
        } else {
            throw new Error(`Invalid FieldDesc: ${JSON.stringify(field)}`);
        }
    }
}
