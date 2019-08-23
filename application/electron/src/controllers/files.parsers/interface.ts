import { Transform } from 'stream';
import { IMapItem } from '../controller.stream.processor.map';

export { IMapItem };

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
    readAndWrite?(srcFile: string, destFile: string, sourceId: string | number, options: { [key: string]: any }, onMapUpdated?: (map: IMapItem[]) => void): Promise<IMapItem[]>;
}

export abstract class AFileParser {

    public abstract destroy(): void;

    public abstract getName(): string;

    public abstract getAlias(): string;

    public abstract isSupported(file: string): Promise<boolean>;

    public abstract getTransform(options?: any): Transform | undefined;

    public abstract getExtnameFilters(): Array<{ name: string, extensions: string[] }>;

    public abstract getParserFunc(): IFileParserFunc;

}
