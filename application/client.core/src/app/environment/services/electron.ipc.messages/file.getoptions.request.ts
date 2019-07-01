export interface IFileGetOptionsRequest {
    session: string;
    fullFileName: string;
    fileName: string;
    type: string;
    size: number;
}

export class FileGetOptionsRequest {

    public static signature: string = 'FileGetOptionsRequest';
    public signature: string = FileGetOptionsRequest.signature;
    public session: string = '';
    public fullFileName: string = '';
    public fileName: string = '';
    public type: string = '';
    public size: number = -1;

    constructor(params: IFileGetOptionsRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileGetOptionsRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (typeof params.fullFileName !== 'string' || params.fullFileName.trim() === '') {
            throw new Error(`fullFileName should be defined.`);
        }
        if (typeof params.fileName !== 'string' || params.fileName.trim() === '') {
            throw new Error(`fileName should be defined.`);
        }
        if (typeof params.type !== 'string' || params.type.trim() === '') {
            throw new Error(`type should be defined.`);
        }
        if (typeof params.size !== 'number' || isNaN(params.size) || !isFinite(params.size)) {
            throw new Error(`size should be defined.`);
        }
        this.session = params.session;
        this.fullFileName = params.fullFileName;
        this.fileName = params.fileName;
        this.type = params.type;
        this.size = params.size;
    }
}
