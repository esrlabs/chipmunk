import { TabsService, ITabAPI } from '@elements/tabs/service';
import { Subscriber } from '@platform/env/subscription';

export abstract class Base extends Subscriber {
    public abstract destroy(): Promise<void>;
    public abstract bind(tab: ITabAPI): void;
    public abstract uuid(): string;
    public abstract sidebar(): TabsService | undefined;
    public abstract toolbar(): TabsService | undefined;
    public abstract isBound(): boolean;
}
