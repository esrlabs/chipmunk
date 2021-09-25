// tslint:disable:only-arrow-functions
export interface IMessagePackage {
    sequence?: string;
    message?: any;
    created?: number;
}

export const getSequence: () => string = (function () {
    let sequence: number = Date.now();
    return function () {
        return `${Date.now()}:${sequence++}`;
    };
})();

export class IPCMessagePackage {
    public sequence: string = '';
    public message: any;
    public created: number;

    constructor(params: IMessagePackage) {
        if (typeof params !== 'object' || params === null || params.message === undefined) {
            throw new Error(`At least property "message" should be defined`);
        }
        if (typeof params.sequence !== 'string' || params.sequence.trim() === '') {
            params.sequence = getSequence();
        }
        if (params.created === undefined) {
            params.created = Date.now();
        }
        this.sequence = params.sequence;
        this.message = params.message;
        this.created = params.created;
    }
}
