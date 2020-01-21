import { IFilePickerFileInfo } from './file.filepicker.response';

export interface IDLTDeamonConnectionOptions {
    ecu: string;
    bindingAddress: string;
    bindingPort: string;
    multicastAddress: string;
    multicastInterface: string;
    fibex: IFilePickerFileInfo[];
}

export interface IDLTDeamonRecentResponse {
    recent: IDLTDeamonConnectionOptions[];
}

export class DLTDeamonRecentResponse {

    public static signature: string = 'DLTDeamonRecentResponse';
    public signature: string = DLTDeamonRecentResponse.signature;
    public recent: IDLTDeamonConnectionOptions[] = [];

    constructor(params: IDLTDeamonRecentResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for DLTDeamonRecentResponse message`);
        }
        if (!(params.recent instanceof Array)) {
            throw new Error(`recent should be defined.`);
        }
        this.recent = params.recent;
    }
}
