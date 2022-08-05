import { Subject } from '@platform/env/subscription';

export interface Setter {
    message(msg: string | undefined): Setter;
    type(type: 'info' | 'error' | 'warn'): Setter;
    spinner(spinner: boolean): Setter;
}
export class Progress {
    public updated: Subject<void> = new Subject();
    public message: string | undefined;
    public type: 'info' | 'error' | 'warn' = 'info';
    public spinner: boolean = true;

    constructor(spinner: boolean, message: string | undefined) {
        this.message = message;
        this.spinner = spinner;
    }

    public set(): Setter {
        const setter = {
            message: (msg: string | undefined): Setter => {
                this.message = msg;
                this.updated.emit();
                return setter;
            },
            type: (type: 'info' | 'error' | 'warn'): Setter => {
                this.type = type;
                this.updated.emit();
                return setter;
            },
            spinner: (spinner: boolean): Setter => {
                this.spinner = spinner;
                this.updated.emit();
                return setter;
            },
        };
        return setter;
    }
}
