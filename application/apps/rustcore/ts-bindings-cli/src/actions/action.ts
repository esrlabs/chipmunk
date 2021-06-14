export abstract class Action {
    /**
     * Returns name of actions
     * @return {string}
     */
    abstract name(): string;
    /**
     * Returns a list of command keys for this command
     * Ex: --open; -o
     * @return {string[]}
     */
    abstract key(): string[];
    /**
     * Returns patern of usage
     * Ex: --open filename
     * @return {string}
     */
    abstract pattern(): string;
    /**
     * Check if arguments are valid
     */
    abstract valid(args: string[]): Promise<void>;
    /**
     * Starts action with given arguments
     * Should return arguments, which weren't used for action
     * @return {string[]}
     */
    abstract proceed(args: string[]): Promise<string[]>;

}