import { TabsService, ITabAPI } from '@elements/tabs/service';

export abstract class Base {
    public abstract destroy(): Promise<void>;
    public abstract bind(tab: ITabAPI): void;
    public abstract uuid(): string;
    public abstract sidebar(): TabsService | undefined;
    public abstract toolbar(): TabsService | undefined;
    public abstract isBound(): boolean;
}
