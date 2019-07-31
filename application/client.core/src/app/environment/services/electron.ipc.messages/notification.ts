export enum ENotificationType {
    info = 'info',
    error = 'error',
    warning = 'warning',
}

export interface INotification {
    message: string;
    caption: string;
    data?: any;
    type?: ENotificationType | string;
}

export class Notification {

    public static Types = ENotificationType;
    public static signature: string = 'Notification';
    public signature: string = Notification.signature;
    public message: string = '';
    public caption: string = '';
    public type: ENotificationType = ENotificationType.info;
    public data: any;

    constructor(params: INotification) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for Notification message`);
        }
        this.message = typeof params.message === 'string' ? params.message : '';
        this.caption = typeof params.caption === 'string' ? params.caption : '';
        this.data = params.data;
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
