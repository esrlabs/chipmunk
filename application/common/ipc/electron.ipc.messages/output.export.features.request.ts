export enum EOutputExportFeaturesSource {
    search = 'search',
    output = 'output',
    all = 'all',
}

export interface IOutputExportFeaturesRequest {
    session: string;
    source: EOutputExportFeaturesSource;
}

export class OutputExportFeaturesRequest {

    public static signature: string = 'OutputExportFeaturesRequest';
    public signature: string = OutputExportFeaturesRequest.signature;
    public session: string = '';
    public source: EOutputExportFeaturesSource;

    constructor(params: IOutputExportFeaturesRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for OutputExportFeaturesRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        this.session = params.session;
        this.source = params.source;
    }
}
