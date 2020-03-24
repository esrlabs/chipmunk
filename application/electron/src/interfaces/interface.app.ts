export enum EExitCodes {
    normal = 0,
    update = 131,
    restart = 132,
}
export interface IApplication {
    init: () => Promise<any>;
    close: () => Promise<void>;
    destroy: (code: EExitCodes) => Promise<void>;
}
