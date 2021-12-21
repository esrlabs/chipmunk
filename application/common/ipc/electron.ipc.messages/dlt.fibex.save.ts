import { IFilePickerFileInfo } from './file.filepicker.response';

export interface IFibex {
    dlt: string;
    fibexFiles: IFilePickerFileInfo[];
}

export class DLTFibexSave {
    public static signature: string = 'DLTFibexSave';
    public signature: string = DLTFibexSave.signature;
    public dlt: string;
    public fibexFiles: IFilePickerFileInfo[];

    constructor(params: IFibex) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for DLTFibexSave message`);
        }
        if (typeof params.dlt !== 'string' || params.dlt.trim() === '') {
            throw new Error(`dlt should not be an empty string`);
        }
        if (!(params.fibexFiles instanceof Array)) {
            throw new Error(`Expecting fibexFiles to be an Array<IFilePickerFileInfo>`);
        }
        this.dlt = params.dlt;
        this.fibexFiles = params.fibexFiles;
    }
}
