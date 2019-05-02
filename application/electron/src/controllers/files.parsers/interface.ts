import { Transform } from 'stream';

export interface IFileParserFunc {
    parse: (chunk: Buffer) => Promise<string | Buffer>;
    rest: () => string | Buffer;
    close: () => void;
}

export abstract class AFileParser {

    public abstract getName(): string;

    public abstract isSupported(file: string): boolean;

    public abstract getTransform(): Transform | undefined;

    public abstract getExtnameFilters(): Array<{ name: string, extensions: string[] }>;

    public abstract getParserFunc(): IFileParserFunc;

}
