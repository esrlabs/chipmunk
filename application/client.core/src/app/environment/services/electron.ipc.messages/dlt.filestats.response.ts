export interface IDLTStats {
    app_ids?: string[];
    context_ids?: string[];
    ecu_ids?: string[];
}

export interface IDLTStatsResponse {
    id: string;
    session: string;
    stats: IDLTStats | undefined;
    error?: string;
}

export class DLTStatsResponse {

    public static signature: string = 'DLTStatsResponse';
    public signature: string = DLTStatsResponse.signature;
    public id: string = '';
    public stats: IDLTStats | undefined;
    public session: string = '';
    public error: string | undefined;

    constructor(params: IDLTStatsResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for DLTStatsResponse message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`id should be defined.`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        this.id = params.id;
        this.error = params.error;
        this.stats = params.stats;
        this.session = params.session;
    }
}
