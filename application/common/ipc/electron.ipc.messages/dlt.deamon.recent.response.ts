import { IFilePickerFileInfo } from './file.filepicker.response';
import { EDLTDeamonConnectionType } from './dlt.deamon.connect.request';

export { EDLTDeamonConnectionType };

export interface IDLTDeamonConnectionMulticastOptions {
    address: string;
    interface: string;
}

export interface IDLTDeamonConnectionOptions {
    ecu: string;
    bindingAddress: string;
    bindingPort: string;
    multicast: IDLTDeamonConnectionMulticastOptions[];
    fibex: IFilePickerFileInfo[];
    target: EDLTDeamonConnectionType;
    timezone?: string;
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
