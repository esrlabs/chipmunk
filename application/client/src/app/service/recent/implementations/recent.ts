import { IComponentDesc } from '@ui/elements/containers/dynamic/component';

export abstract class RecentAction {
    public abstract asComponent(): IComponentDesc;
    public abstract description(): {
        short: string;
        full: string;
    };
    public abstract asObj(): { [key: string]: unknown };
    public abstract from(inputs: { [key: string]: unknown }): RecentAction;
}
