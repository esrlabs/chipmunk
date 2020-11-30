/**
 * TODO:
 * Method destroy should be asynch on NodeJS level. It should returns standard (not cancelable) promise.
 * Because from rust we cannot return a promise, method should be implemented here. Considering:
 * - prevent multiple calls
 * - listen event destroy and resolve on it
 * - add timeout and reject on it
 * - listen error and ? What to do it error was between calling destroy and getting event destroy?
 * - naming: destroy good for NodeJS level, on Rust level probably shutdown would be fine
 */
export abstract class RustChannelRequiered {
    public abstract destroy(): void;
}
