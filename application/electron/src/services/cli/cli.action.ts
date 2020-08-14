export type TAction = () => Promise<void>;

export abstract class CLIAction {

    public abstract getTask(pwd: string, args: string[]): Promise<TAction | undefined>;
    public abstract clear(args: string[]): string[];

}
