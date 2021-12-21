import { IFilePickerFileInfo } from './file.filepicker.response';

export interface IDLTFibexLoadResponse {
    fibexFiles: IFilePickerFileInfo[];
}

export class DLTFibexLoadResponse {
    public static signature: string = 'DLTFibexLoadResponse';
    public signature: string = DLTFibexLoadResponse.signature;
    public fibexFiles: IFilePickerFileInfo[];

    constructor(params: IDLTFibexLoadResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for DLTFibexLoadResponse message`);
        }
        if (!(params.fibexFiles instanceof Array)) {
            throw new Error(`Expecting fibexFiles to be an Array<IFilePickerFileInfo>`);
        }
        this.fibexFiles = params.fibexFiles;
    }
}
