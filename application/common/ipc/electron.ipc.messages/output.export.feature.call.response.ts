
export interface IOutputExportFeatureCallResponse {
    session: string;
    actionId: string;
    error?: string;
}

export class OutputExportFeatureCallResponse {

    public static signature: string = 'OutputExportFeatureCallResponse';
    public signature: string = OutputExportFeatureCallResponse.signature;
    public session: string = '';
    public actionId: string = '';
    public error?: string;

    constructor(params: IOutputExportFeatureCallResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for OutputExportFeatureCallResponse message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (typeof params.actionId !== 'string' || params.actionId.trim() === '') {
            throw new Error(`actionId should be defined.`);
        }
        this.session = params.session;
        this.actionId = params.actionId;
        this.error = params.error;
    }
}
