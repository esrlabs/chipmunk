export interface IAdbStreamUpdated {
    guid: string;
    amount: number;
}

export class AdbStreamUpdated {
    public static signature: string = 'AdbStreamUpdated';
    public signature: string = AdbStreamUpdated.signature;
    public guid: string;
    public amount: number;

    constructor(params: IAdbStreamUpdated) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for AdbStreamUpdated message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        if (typeof params.amount !== 'number' || isNaN(params.amount) || !isFinite(params.amount)) {
            throw new Error(`Field "amount" should be defined as number (not NaN and finited)`);
        }
        this.guid = params.guid;
        this.amount = params.amount;
    }
}
