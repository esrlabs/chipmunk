import { ControllerSessionTab } from './controller.session.tab';

export interface IDisabledEntitySupport {

    getDisplayName(): string;
    getIcon(): string;
    getGUID(): string;
    remove(session: ControllerSessionTab): void;
    restore(session: ControllerSessionTab): void;
    matches?(session: ControllerSessionTab): void;

}
