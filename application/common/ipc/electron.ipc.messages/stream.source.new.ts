export interface IStreamSourceNew {
    id: number;
    name: string;
    session: string;
    meta?: string;
}

export class StreamSourceNew {
    public static signature: string = 'StreamSourceNew';
    public signature: string = StreamSourceNew.signature;
    public id: number;
    public name: string;
    public session: string;
    public meta?: string;

    constructor(params: IStreamSourceNew) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for StreamSourceNew message`);
        }
        if (typeof params.name !== 'string' || params.name.trim() === '') {
            throw new Error(`Field "name" should be defined as string`);
        }
        if (typeof params.id !== 'number' || isNaN(params.id) || !isFinite(params.id)) {
            throw new Error(`Field "id" should be defined as number`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Field "session" should be defined as string`);
        }
        this.id = params.id;
        this.name = params.name;
        this.session = params.session;
        this.meta = params.meta;
    }
}
