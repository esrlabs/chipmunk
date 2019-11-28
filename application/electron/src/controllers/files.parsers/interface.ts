import { IMapItem } from '../stream.main/file.map';
import { Progress } from "indexer-neon";
import { CancelablePromise } from '../../tools/index';

type ITicks = Progress.ITicks;

export { IMapItem, ITicks };

export interface IReadWriteResult {
    streamId: string;
    map: IMapItem[];
}

export abstract class AFileParser {

    public abstract destroy(): Promise<void>;

    public abstract getName(): string;

    public abstract getAlias(): string;

    public abstract isSupported(file: string): Promise<boolean>;

    public abstract getExtnameFilters(): Array<{ name: string, extensions: string[] }>;

    public abstract abort(): Promise<void>;

    public abstract parseAndIndex(
        srcFile: string,
        destFile: string,
        sourceId: string | number,
        options: { [key: string]: any }, // TODO [dmitry]: get rid of options, add typed interface
        onMapUpdated?: (map: IMapItem[]) => void,
        onProgress?: (ticks: Progress.ITicks) => void): CancelablePromise<IMapItem[], void>;

}
