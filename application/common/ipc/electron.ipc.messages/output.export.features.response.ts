export interface IExportAction {
    caption: string;
    id: string;
    enabled: boolean;    
}

export interface IOutputExportFeaturesResponse {
    session: string;
    actions: IExportAction[];
}

export class OutputExportFeaturesResponse {

    public static signature: string = 'OutputExportFeaturesResponse';
    public signature: string = OutputExportFeaturesResponse.signature;
    public session: string = '';
    public actions: IExportAction[] = [];

    constructor(params: IOutputExportFeaturesResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for OutputExportFeaturesResponse message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        if (!(params.actions instanceof Array)) {
            throw new Error(`actions should be defined as an Array.`);
        }
        this.session = params.session;
        this.actions = params.actions;
    }
}
