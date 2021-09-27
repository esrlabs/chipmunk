import { Observable } from 'rxjs';

export interface IImportedData {
    hash: number;
    data: string;
}

export abstract class Importable<T> {
    public abstract export(): Promise<T | undefined>;

    public abstract import(data: T): Promise<void>;

    public abstract getImporterUUID(): string;

    public abstract getExportObservable(): Observable<void>;
}
