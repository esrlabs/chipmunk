export enum AvailableViews {
    SearchManager = 'SearchManager',
    CommentsManager = 'CommentsManager',
    DLTConnector = 'DLTConnector',
    SearchResults = 'SearchResults',
    Charts = 'Charts',
    TimeMeasurement = 'TimeMeasurement',
    Notifications = 'Notifications',
    Shell = 'Shell',
    Concat = 'Concat',
    Merge = 'Merge',
}

export interface IViewSwitchEvent {
    session: string;
    target: AvailableViews;
}

export class ViewSwitchEvent {

    public static signature: string = 'ViewSwitchEvent';
    public signature: string = ViewSwitchEvent.signature;
    public target: AvailableViews;
    public session: string;

    constructor(params: IViewSwitchEvent) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ViewSwitchEvent message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        if (typeof params.target !== 'string' || params.target.trim() === '') {
            throw new Error(`Expecting target to be a string`);
        }
        this.session = params.session;
        this.target = params.target;
    }
}
