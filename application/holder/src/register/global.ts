export interface IApplication {
    shutdown(): {
        update(): Promise<void>;
        restart(): Promise<void>;
        close(): Promise<void>;
    };
}

export interface ChipmunkGlobal extends Global {
    application: IApplication;
}
