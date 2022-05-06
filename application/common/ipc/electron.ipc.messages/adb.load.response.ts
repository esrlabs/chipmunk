import { IAdbSession } from '../../interfaces/interface.adb';

export interface IAdbLoadResponse {
    data: IAdbSession;
    session: string;
}

export class AdbLoadResponse {

    public static signature: string = 'AdbLoadResponse';
    public signature: string = AdbLoadResponse.signature;
    public data: IAdbSession;
    public session: string;

    constructor(params: IAdbLoadResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for AdbLoadResponse message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Field "session" should be defined`);
        }
        if (typeof params.data !== 'object' || params.data === null) {
            throw new Error(`Field "data" should be defined`);
        }
        this.session = params.session;
        this.data = params.data;
    }
}
