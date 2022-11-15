import { Service } from '@service/cli';

export enum Type {
    StateModifier,
    Action,
    AfterActions,
}

export abstract class CLIAction {
    /**
     * Checks incoming arguments and apply related actions, if it's possible.
     * Returns list of arguments, which weren't used for current actions
     * @param cli - reference to cli service
     * @param args - list of arguments
     */
    public abstract execute(cli: Service): Promise<void>;
    /**
     * Returns type of action
     * StateModifier - would be applied before any actions. Used to define
     * some parameters for executing actions (like parser type)
     * Action - actions, which would be applied after all StateModifiers are
     * done,
     * AfterActions - actions, which would be applied in last queue (like
     * search). Such kind of actions are applied to each created by Actions
     * session.
     */
    public abstract type(): Type;
    /**
     * Returns name of action
     */
    public abstract name(): string;
    /**
     * Parsing incoming argument
     * @param cwd current working folder
     * @param arg argument to parse
     */
    public abstract argument(cwd: string, arg: string): string;
    /**
     * Returns list of parsing errors
     */
    public abstract errors(): Error[];
    /**
     * Returns true is action should be applied. False - if not.
     */
    public abstract defined(): boolean;
}
