import { IFilePickerFileInfo } from './file.filepicker.response';
import { IDLTDeamonConnectionMulticastOptions } from './dlt.deamon.recent.response';

export enum EDLTDeamonConnectionType {
    Tcp = 'Tcp',
    Udp = 'Udp',
}

export interface IDLTDeamonConnectRequest {
    id: string;
    session: string;
    ecu: string;
    bindingAddress: string;
    bindingPort: string;
    multicast: IDLTDeamonConnectionMulticastOptions[];
    fibex: IFilePickerFileInfo[];
    target: EDLTDeamonConnectionType;
    timezone: string | undefined;
}

export class DLTDeamonConnectRequest {
    public static signature: string = 'DLTDeamonConnectRequest';
    public signature: string = DLTDeamonConnectRequest.signature;
    public id: string = '';
    public session: string = '';
    public ecu: string = '';
    public bindingAddress: string = '';
    public bindingPort: string = '';
    public timezone: string | undefined;
    public multicast: IDLTDeamonConnectionMulticastOptions[];
    public fibex: IFilePickerFileInfo[] = [];
    public target: EDLTDeamonConnectionType = EDLTDeamonConnectionType.Udp;

    constructor(params: IDLTDeamonConnectRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for DLTDeamonConnectRequest message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (typeof params.ecu !== 'string' || params.ecu.trim() === '') {
            throw new Error(`ecu should be defined.`);
        }
        if (typeof params.bindingAddress !== 'string' || params.bindingAddress.trim() === '') {
            throw new Error(`bindingAddress should be defined.`);
        }
        if (typeof params.bindingPort !== 'string' || params.bindingPort.trim() === '') {
            throw new Error(`bindingPort should be defined.`);
        }
        if (!(params.multicast instanceof Array)) {
            throw new Error(`multicast should be an Array.`);
        }
        if (!(params.fibex instanceof Array)) {
            throw new Error(`fibex should be defined.`);
        }
        if (typeof params.target !== 'string' || params.target.trim() === '') {
            throw new Error(`target should be defined.`);
        }
        if (typeof params.timezone !== 'string' && params.timezone !== undefined) {
            throw new Error(`timezone should be defined as string.`);
        }
        this.id = params.id;
        this.session = params.session;
        this.ecu = params.ecu;
        this.bindingAddress = params.bindingAddress;
        this.bindingPort = params.bindingPort;
        this.multicast = params.multicast;
        this.fibex = params.fibex;
        this.target = params.target;
        this.timezone = params.timezone;
    }
}
