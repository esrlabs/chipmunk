import { getHash } from './helpers/hash';
import { Observable } from 'rxjs';

export interface IImportedData {
    hash: number;
    data: string;
}

export abstract class Importable {

    public abstract export(): Promise<IImportedData | undefined>;

    public abstract import(data: IImportedData): Promise<void>;

    public abstract getImporterUUID(): string;

    public abstract getExportObservable(): Observable<void>;

    public getDataHash(str: string): number {
        return getHash(str);
    }

}
