export abstract class Equal<T> {
    abstract isSame(entity: T): boolean;
}

export abstract class Empty {
    abstract isEmpty(): boolean;
}
