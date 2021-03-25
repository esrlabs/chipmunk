
export interface IOutputExportFeatureSelectionRequest {
    session: string;
    actionId: string;
}

export class OutputExportFeatureSelectionRequest {

    public static signature: string = 'OutputExportFeatureSelectionRequest';
    public signature: string = OutputExportFeatureSelectionRequest.signature;
    public session: string = '';
    public actionId: string = '';

    constructor(params: IOutputExportFeatureSelectionRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for OutputExportFeatureSelectionRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (typeof params.actionId !== 'string' || params.actionId.trim() === '') {
            throw new Error(`actionId should be defined.`);
        }
        this.session = params.session;
        this.actionId = params.actionId;
    }
}
