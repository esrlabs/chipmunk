export interface IDLTStatsRecord {
    non_log: number;
    log_fatal: number;
    log_error: number;
    log_warning: number;
    log_info: number;
    log_debug: number;
    log_verbose: number;
    log_invalid: number;
}

export interface IDLTStats {
    app_ids?: Array<string | IDLTStatsRecord>;
    context_ids?: Array<string | IDLTStatsRecord>;
    ecu_ids?: Array<string | IDLTStatsRecord>;
}

export interface IDLTStatsResponse {
    id: string;
    session: string;
    stats: IDLTStats | undefined;
    error?: string;
    logs?: ILogMessage[];
}

export interface ILogMessage {
    severity: string;
    text: string;
    line_nr: number | null;
    file_name?: string;
}

export class DLTStatsResponse {

    public static signature: string = 'DLTStatsResponse';
    public signature: string = DLTStatsResponse.signature;
    public id: string = '';
    public stats: IDLTStats | undefined;
    public session: string = '';
    public error: string | undefined;
    public logs: ILogMessage[] | undefined;

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
        this.logs = params.logs;
        this.stats = params.stats;
        this.session = params.session;
    }
}
