export interface IFilePickerFilter {
    name: string;
    extensions: string[];
}

export interface IFilePickerRequest {
    filter?: IFilePickerFilter[];
    multiple?: boolean;
}

export class FilePickerRequest {

    public static signature: string = 'FilePickerRequest';
    public signature: string = FilePickerRequest.signature;
    public filter: IFilePickerFilter[] | undefined;
    public multiple: boolean | undefined;

    constructor(params: IFilePickerRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FilePickerRequest message`);
        }
        if (params.filter !== undefined && !(params.filter instanceof Array)) {
            throw new Error(`filter should be defined as IFilePickerFilter[].`);
        }
        if (params.multiple !== undefined && typeof params.multiple !== 'boolean') {
            throw new Error(`multiple should be defined as string.`);
        }
        this.filter = params.filter;
        this.multiple = params.multiple;
    }
}
