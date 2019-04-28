import { Transform } from 'stream';

export abstract class AFileParser {

    public abstract getName(): string;

    public abstract isSupported(file: string): boolean;

    public abstract getTransform(): Transform | undefined;

    public abstract getExtnameFilters(): Array<{ name: string, extensions: string[] }>;

}
