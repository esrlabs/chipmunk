import { IComponentDesc } from '@ui/elements/containers/dynamic/component';

export abstract class RecentAction {
    public abstract apply(): Promise<void>;
    public abstract asComponent(): IComponentDesc;
    public abstract description(): {
        short: string;
        full: string;
    };
    public abstract asJSON(): string;
    public abstract fromJSON(str: string): Error | undefined;
}
