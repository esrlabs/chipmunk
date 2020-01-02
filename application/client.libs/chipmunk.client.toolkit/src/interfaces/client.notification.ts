export enum ENotificationType {
    info = 'info',
    error = 'error',
    warning = 'warning',
}

export interface INotificationOptions {
    closeDelay?: number;
    closable?: boolean;
    type?: ENotificationType;
    once?: boolean;
}

export interface INotificationButton {
    caption: string;
    handler: (...args: any[]) => any;
}

export interface INotificationComponent {
    factory: any;
    inputs: any;
}

export interface INotification {
    session?: string;
    id?: string;
    caption: string;
    row?: number;
    file?: string;
    message?: string;
    component?: INotificationComponent;
    progress?: boolean;
    buttons?: INotificationButton[];
    options?: INotificationOptions;
    closing?: boolean;
    read?: boolean;
}
