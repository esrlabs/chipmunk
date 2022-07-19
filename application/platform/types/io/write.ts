export abstract class WriteAsString {
    public abstract write(content: string): Error | undefined;
}

export abstract class Write<T> {
    public abstract write(content: T): Error | undefined;
}
