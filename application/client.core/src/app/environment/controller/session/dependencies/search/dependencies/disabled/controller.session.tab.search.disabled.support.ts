import { Session } from '../../../../session';

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
    remove(session: Session): void;
    restore(session: Session): void;
    matches?(session: Session): void;
    asDesc(): any;
}
