export interface IConcatFilesRequest {
    id: string;
    files: string[];
    session: string;
}

export class ConcatFilesRequest {

    public static signature: string = 'ConcatFilesRequest';
    public signature: string = ConcatFilesRequest.signature;
    public id: string = '';
    public timezone: string = '';
    public files: string[] = [];
    public session: string = '';

    constructor(params: IConcatFilesRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ConcatFilesRequest message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (params.files !== undefined && !(params.files instanceof Array)) {
            throw new Error(`parsers should be defined as Array<string>.`);
        }
        this.id = params.id;
        this.files = params.files;
        this.session = params.session;
    }
}
