import { unique } from '@platform/env/sequence';
import { Subject } from '@platform/env/subscription';
import { Level } from '../notification/index';

export interface Button {
    caption: string;
    handler: () => void;
}
export interface Setter {
    message(msg: string | undefined): Setter;
    type(type: Level): Setter;
    spinner(spinner: boolean): Setter;
    group(uuid: string): Setter;
    buttons(buttons: Button[]): Setter;
    end(): Locker;
}
export class Locker {
    public updated: Subject<void> = new Subject();
    public message: string | undefined;
    public buttons: Button[] = [];
    public type: Level = Level.info;
    public spinner: boolean = true;
    public group: string = unique();
    public uuid: string = unique();
    public created: number = Date.now();

    constructor(spinner: boolean, message: string | undefined) {
        this.message = message;
        this.spinner = spinner;
    }

    public getLevel(): Level {
        return this.type;
    }

    public getGroup(): string {
        return this.group;
    }

    public getTime(): string {
        return new Date(this.created).toLocaleTimeString();
    }

    public set(): Setter {
        const setter = {
            message: (msg: string | undefined): Setter => {
                this.message = msg;
                this.updated.emit();
                return setter;
            },
            type: (type: Level): Setter => {
                this.type = type;
                this.updated.emit();
                return setter;
            },
            spinner: (spinner: boolean): Setter => {
                this.spinner = spinner;
                this.updated.emit();
                return setter;
            },
            group: (uuid: string): Setter => {
                this.group = uuid;
                this.updated.emit();
                return setter;
            },
            buttons: (buttons: Button[]): Setter => {
                this.buttons = buttons;
                this.updated.emit();
                return setter;
            },
            end: (): Locker => {
                return this;
            },
        };
        return setter;
    }
}
