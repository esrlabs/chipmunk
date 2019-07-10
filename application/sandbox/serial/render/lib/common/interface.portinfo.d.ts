export interface IPortInfo {
    comName: string;
    manufacturer?: string;
    serialNumber?: string;
    pnpId?: string;
    locationId?: string;
    productId?: string;
    vendorId?: string;
}
export interface IIOState {
    read: number;
    written: number;
}
export interface IPortState {
    ioState: IIOState;
    connections: number;
}
