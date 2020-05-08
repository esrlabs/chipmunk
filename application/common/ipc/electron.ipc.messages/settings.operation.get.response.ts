
export interface ISettingsOperationGetResponse {
    value: string | boolean | number;
}

export class SettingsOperationGetResponse {

    public static signature: string = 'SettingsOperationGetResponse';
    public signature: string = SettingsOperationGetResponse.signature;
    public value: string | boolean | number;

    constructor(params: ISettingsOperationGetResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsOperationGetResponse message`);
        }
        if (params.value === undefined) {
            throw new Error(`Field "value" should be defined`);
        }
        this.value = params.value;
    }
}
