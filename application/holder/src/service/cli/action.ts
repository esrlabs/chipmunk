import { Service } from '@service/cli';

export abstract class CLIAction {
    /**
     * Checks incoming arguments and apply related actions, if
     * it's possible.
     * Returns list of arguments, which weren't used for current
     * actions
     */
    public abstract execute(cli: Service, args: string[]): Promise<string[]>;
}
