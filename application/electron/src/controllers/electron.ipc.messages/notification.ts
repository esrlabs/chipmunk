export enum ENotificationType {
    info = 'info',
    error = 'error',
    warning = 'warning',
}

export enum ENotificationActionType {
    ipc = 'ipc',
    close = 'close',
}

export interface INotificationAction {
    type: ENotificationActionType;
    caption: string;
    value: any;
}

export interface INotification {
    message: string;
    caption: string;
    session?: string;
    file?: string;
    row?: number;
    data?: any;
    type?: ENotificationType | string;
    actions?: INotificationAction[];
}

export class Notification {

    public static Types = ENotificationType;
    public static signature: string = 'Notification';
    public signature: string = Notification.signature;
    public message: string = '';
    public caption: string = '';
    public type: ENotificationType = ENotificationType.info;
    public data: any;
    public session: string | undefined;
    public file: string | undefined;
    public row: number | undefined;
    public actions: INotificationAction[] | undefined;

    constructor(params: INotification) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for Notification message`);
        }
        this.message = typeof params.message === 'string' ? params.message : '';
        this.caption = typeof params.caption === 'string' ? params.caption : '';
        this.data = params.data;
        this.session = params.session;
        this.file = params.file;
        this.row = params.row;
        this.actions = params.actions;
        this.type = typeof params.type === 'string' ? this._getNotificationType(params.type) : ENotificationType.info;
    }

    private _getNotificationType(log: string) {
        if (typeof log !== 'string') {
            return ENotificationType.info;
        }
        switch (log.toLowerCase()) {
            case 'error':
            case 'err':
                return ENotificationType.error;
            case 'warning':
            case 'warn':
                return ENotificationType.warning;
            default:
                return ENotificationType.info;
        }
    }
}
