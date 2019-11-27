
export interface IFilePickerFileInfo {
    path: string;       // Full file name (path + basename)
    name: string;       // Only basename
    size: number;       // Size in bytes
    created: number;    // unixtime
    changed: number;    // unixtime
}

export interface IFilePickerResponse {
    files: IFilePickerFileInfo[];
    error?: string;
}

export class FilePickerResponse {

    public static signature: string = 'FilePickerResponse';
    public signature: string = FilePickerResponse.signature;
    public files: IFilePickerFileInfo[] = [];
    public error: string | undefined;

    constructor(params: IFilePickerResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FilePickerResponse message`);
        }
        if (!(params.files instanceof Array)) {
            throw new Error(`files should be defined as IFilePickerFileInfo[].`);
        }
        if (params.error !== undefined && typeof params.error !== 'string') {
            throw new Error(`error can be defined only as string`);
        }
        this.files = params.files;
        this.error = params.error;
    }
}
