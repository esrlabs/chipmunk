export interface JsonField {
    [key: string]: string;
}

export type JsonSet = JsonField[];

export abstract class Json<T> {
    abstract json(): {
        to(): string;
        from(str: string): T | Error;
        key(): string;
    };
    public asJsonField(): JsonField {
        return { [this.json().key()]: this.json().to() };
    }
}

export interface Extractor<T> {
    from(str: string): T | Error;
    key(): string;
}

export interface JsonConvertor<T> {
    json(): {
        to(): string;
        from(str: string): T | Error;
    };
}
