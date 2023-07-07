export abstract class Equal<T> {
    abstract isSame(entity: T): boolean;
}

export abstract class Empty {
    public abstract isEmpty(): boolean;
}

export abstract class Validate<T> {
    public abstract validate(smth: T): Error | T;
}

export abstract class SelfValidate {
    public abstract validate(): Error | undefined;
}

export abstract class Storable<T> {
    public abstract storable(): T;
}

export abstract class Alias<T> {
    public abstract alias(): T;
}

export abstract class Signature<T> {
    public abstract signature(): T;
}

export abstract class Hash<T> {
    public abstract hash(): T;
}

export abstract class Destroy {
    public abstract destroy(): void;
}
