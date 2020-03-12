export interface IApplication {
    init: () => Promise<any>;
    close: () => Promise<void>;
    destroy: () => Promise<void>;
}
