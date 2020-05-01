export enum ENotificationType {
    info = 'info',
    error = 'error',
    warning = 'warning',
    accent = 'accent',
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
    buttons?: INotificationButton[];
    options?: INotificationOptions;
    read?: boolean;
    // Will be depricated
    component?: INotificationComponent;
    closing?: boolean;
    progress?: boolean;
}
