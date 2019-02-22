// tslint:disable:only-arrow-functions
export interface IMessagePackage {
    sequence?: string;
    stream?: string;
    message?: any;
    token?: string | null;
    created?: number;
}

export const getSequence: () => string = (function() {
    let sequence: number = Date.now();
    return function() {
        return `${process.pid}:${sequence++}`;
    };
}());

export class IPCMessagePackage {

    public sequence: string = '';
    public message: any;
    public stream?: string;
    public token: string | null;
    public created: number;

    constructor(params: IMessagePackage) {
        if (typeof params !== 'object' || params === null || params.message === undefined) {
            throw new Error(`At least property "message" should be defined`);
        }
        if (typeof params.sequence !== 'string' || params.sequence.trim() === '') {
            params.sequence = getSequence();
        }
        if (typeof params.token !== 'string' || params.token.trim() === '') {
            params.token = null;
        }
        if (params.created === undefined) {
            params.created = Date.now();
        }
        this.sequence = params.sequence;
        this.token = params.token;
        this.stream = params.stream;
        this.message = params.message;
        this.created = params.created;
    }

}
