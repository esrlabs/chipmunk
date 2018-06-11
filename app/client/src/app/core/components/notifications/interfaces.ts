export enum ENotificationTypes {
    warning = 'warning',
    info = 'info'
}

export interface INotificationButton {
    caption: string,
    handler: Function
}

export interface INotification{
    id?: string,
    message: string,
    caption: string,
    type?: ENotificationTypes,
    buttons?: Array<INotificationButton>,
    closable?: boolean,
    addCloseHandler?: boolean
    progress?: boolean,
    _closeTimerId?: number,
    _closing?: boolean
}
