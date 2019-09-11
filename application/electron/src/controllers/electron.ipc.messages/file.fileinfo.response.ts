export interface IParser {
    name: string;
    desc: string;
}
export interface IFileInfoResponse {
    path: string;
    name: string;
    size: number;
    created: number;
    changed: number;
    parser?: string;
    defaults?: string;
    parsers?: IParser[];
}

export class FileInfoResponse {

    public static signature: string = 'FileInfoResponse';
    public signature: string = FileInfoResponse.signature;
    public path: string = '';
    public name: string = '';
    public size: number = -1;
    public created: number = -1;
    public changed: number = -1;
    public parser: string | undefined;
    public defaults: string | undefined;
    public parsers: IParser[] | undefined;

    constructor(params: IFileInfoResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileInfoResponse message`);
        }
        if (typeof params.path !== 'string' || params.path.trim() === '') {
            throw new Error(`path should be defined.`);
        }
        if (typeof params.name !== 'string' || params.name.trim() === '') {
            throw new Error(`name should be defined.`);
        }
        if (params.parser !== undefined && typeof params.parser !== 'string') {
            throw new Error(`parser should be defined as string.`);
        }
        if (params.parsers !== undefined && !(params.parsers instanceof Array)) {
            throw new Error(`parsers should be defined as Array<IParser>.`);
        }
        if (typeof params.size !== 'number' || isNaN(params.size) || !isFinite(params.size)) {
            throw new Error(`size should be defined.`);
        }
        if (typeof params.created !== 'number' || isNaN(params.created) || !isFinite(params.created)) {
            throw new Error(`created should be defined.`);
        }
        if (typeof params.changed !== 'number' || isNaN(params.changed) || !isFinite(params.changed)) {
            throw new Error(`changed should be defined.`);
        }
        if (params.defaults !== undefined && typeof params.defaults !== 'string') {
            throw new Error(`defaults should be defined as string.`);
        }
        this.path = params.path;
        this.name = params.name;
        this.size = params.size;
        this.created = params.created;
        this.changed = params.changed;
        this.parser = params.parser;
        this.parsers = params.parsers;
        this.defaults = params.defaults;
    }
}
