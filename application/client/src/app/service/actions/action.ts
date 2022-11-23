export abstract class Base {
    abstract uuid(): string;
    abstract caption(): string;
    abstract apply(): Promise<void>;
    abstract group(): number;
}
