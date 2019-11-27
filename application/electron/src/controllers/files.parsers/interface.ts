import { Transform } from 'stream';
import { IMapItem } from '../stream.main/file.map';
import { Progress } from "indexer-neon";

type ITicks = Progress.ITicks;

export { IMapItem, ITicks };

export interface IReadWriteResult {
    streamId: string;
    map: IMapItem[];
}

export interface IFileParserFunc {
    parse: (chunk: Buffer) => Promise<string | Buffer>;
    rest: () => string | Buffer;
    close: () => void;
}

// tslint:disable-next-line:interface-name
export interface AFileParser {
    parseAndIndex?(
        srcFile: string,
        destFile: string,
        sourceId: string | number,
        options: { [key: string]: any }, // TODO [dmitry]: get rid of options, add typed interface
        onMapUpdated?: (map: IMapItem[]) => void,
        onProgress?: (ticks: Progress.ITicks) => void): Promise<IMapItem[]>;
}

export abstract class AFileParser {

    public abstract destroy(): void;

    public abstract getName(): string;

    public abstract getAlias(): string;

    public abstract isSupported(file: string): Promise<boolean>;

    public abstract isTicksSupported(): boolean;

    public abstract getTransform(options?: any): Transform | undefined;

    public abstract getExtnameFilters(): Array<{ name: string, extensions: string[] }>;

    public abstract getParserFunc(): IFileParserFunc;

}
