
import * as CommonInterfaces from '../../interfaces/index';

export interface IDLTStatsResponse {
    id: string;
    session: string;
    stats: CommonInterfaces.DLT.StatisticInfo | undefined;
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
    public stats: CommonInterfaces.DLT.StatisticInfo | undefined;
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
