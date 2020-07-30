import { ControllerSessionTab } from './controller.session.tab';

export enum EEntityTypeRef {
    chart = 'chart',
    filter = 'filter',
    range = 'range',
}

export interface IDisabledEntitySupport {

    getDisplayName(): string;
    getTypeRef(): EEntityTypeRef;
    getIcon(): string;
    getGUID(): string;
    remove(session: ControllerSessionTab): void;
    restore(session: ControllerSessionTab): void;
    matches?(session: ControllerSessionTab): void;
    asDesc(): any;

}
