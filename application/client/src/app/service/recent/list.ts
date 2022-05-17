import { Action } from './action';
import { error } from '@platform/env/logger';
import { SetupLogger, LoggerInterface } from '@platform/entity/logger';

@SetupLogger()
export class List {
    public actions: Action[] = [];

    public asJSON(): string {
        return '';
    }
    public fromJSON(str: string): List {
        const actions = JSON.parse(str);
        if (!(actions instanceof Array)) {
            throw new Error(
                `Expected format of recent action is an array. Actual type: ${typeof actions}`,
            );
        }
        this.actions = actions
            .map((action) => {
                try {
                    return new Action().from(action);
                } catch (err) {
                    this.log().error(`Fail convert action item. Error: ${error(err)}`);
                    return undefined;
                }
            })
            .filter((i) => i instanceof Action) as Action[];
        return this;
    }
}
export interface List extends LoggerInterface {}
