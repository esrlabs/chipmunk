import { IComponentDesc } from './client.components.containers';

export interface IOptions {
    closable?: boolean;
    width?: number;
    once?: boolean;
}

export interface IButton {
    caption: string;
    handler: (...args: any[]) => any;
}

export interface IPopup {
    id?: string;
    caption: string;
    message?: string;
    component?: IComponentDesc;
    buttons?: IButton[];
    options?: IOptions;
}
