
export interface IOutputSelectionRange {
    from: number;
    to: number;
}

export interface IOutputExportFeatureCallRequest {
    session: string;
    actionId: string;
    selection: IOutputSelectionRange[];
}

export class OutputExportFeatureCallRequest {

    public static signature: string = 'OutputExportFeatureCallRequest';
    public signature: string = OutputExportFeatureCallRequest.signature;
    public session: string = '';
    public actionId: string = '';
    public selection: IOutputSelectionRange[];

    constructor(params: IOutputExportFeatureCallRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for OutputExportFeatureCallRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (typeof params.actionId !== 'string' || params.actionId.trim() === '') {
            throw new Error(`actionId should be defined.`);
        }
        if (!(params.selection instanceof Array)) {
            throw new Error(`selection should be defined as an Array.`);
        }
        this.session = params.session;
        this.actionId = params.actionId;
        this.selection = params.selection;
    }
}
