
export interface IVersion {
    version: string;
}

export class TabCustomVersion {
    public static signature: string = 'TabCustomVersion';
    public signature: string = TabCustomVersion.signature;
    public version: string;

    constructor(params: IVersion) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for Notification message`);
        }
        if (typeof params.version !== 'string' || params.version.trim() === '') {
            throw new Error(`Incorrect parameters for Version message`);
        }
        this.version = params.version;
    }
}
