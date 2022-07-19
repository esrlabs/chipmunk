export abstract class Destroyable<T> {
    public abstract destroy(): Promise<T>;
}
