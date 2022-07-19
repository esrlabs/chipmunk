export abstract class ReadAsString {
    public abstract read(): Promise<string>;
}

export abstract class Read<T> {
    public abstract read(): Promise<T>;
}
