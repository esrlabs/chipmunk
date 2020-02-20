
export interface IOutputExportFeaturesRequest {
    session: string;
    selection: number[];
}

export class OutputExportFeaturesRequest {

    public static signature: string = 'OutputExportFeaturesRequest';
    public signature: string = OutputExportFeaturesRequest.signature;
    public session: string = '';
    public selection: number[];

    constructor(params: IOutputExportFeaturesRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for OutputExportFeaturesRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (!(params.selection instanceof Array)) {
            throw new Error(`selection should be defined as an Array.`);
        }
        this.session = params.session;
        this.selection = params.selection;
    }
}
