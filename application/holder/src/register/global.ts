import * as cases from '@loader/exitcases';

export interface IApplication {
    shutdown(signal: string): {
        update(upd: cases.Update): Promise<void>;
        restart(cm: cases.Restart): Promise<void>;
        close(): Promise<void>;
    };
}

export interface ChipmunkGlobal extends Global {
    application: IApplication;
}
