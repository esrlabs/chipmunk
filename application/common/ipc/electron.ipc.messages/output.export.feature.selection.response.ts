
import { IOutputSelectionRange } from './output.export.feature.call.request';

export interface IOutputExportFeatureSelectionResponse {
    session: string;
    selection: IOutputSelectionRange[];
    error?: string;
}

export class OutputExportFeatureSelectionResponse {

    public static signature: string = 'OutputExportFeatureSelectionResponse';
    public signature: string = OutputExportFeatureSelectionResponse.signature;
    public session: string = '';
    public selection: IOutputSelectionRange[];
    public error?: string;

    constructor(params: IOutputExportFeatureSelectionResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for OutputExportFeatureSelectionResponse message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (!(params.selection instanceof Array)) {
            throw new Error(`selection should be defined as an Array.`);
        }
        this.session = params.session;
        this.error = params.error;
        this.selection = params.selection;
    }
}
