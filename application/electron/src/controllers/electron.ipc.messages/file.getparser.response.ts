export interface IParser {
    name: string;
    desc: string;
}
export interface IFileGetParserResponse {
    file: string;
    shortname: string;
    parser?: string;
    parsers?: IParser[];
}

export class FileGetParserResponse {

    public static signature: string = 'FileGetParserResponse';
    public signature: string = FileGetParserResponse.signature;
    public file: string = '';
    public shortname: string = '';
    public parser: string | undefined;
    public parsers: IParser[] | undefined;

    constructor(params: IFileGetParserResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileGetParserResponse message`);
        }
        if (typeof params.file !== 'string' || params.file.trim() === '') {
            throw new Error(`file should be defined.`);
        }
        if (typeof params.shortname !== 'string' || params.shortname.trim() === '') {
            throw new Error(`shortname should be defined.`);
        }
        if (params.parser !== undefined && typeof params.parser !== 'string') {
            throw new Error(`parser should be defined as string.`);
        }
        if (params.parsers !== undefined && !(params.parsers instanceof Array)) {
            throw new Error(`parsers should be defined as Array<IParser>.`);
        }
        this.file = params.file;
        this.shortname = params.shortname;
        this.parser = params.parser;
        this.parsers = params.parsers;
    }
}
