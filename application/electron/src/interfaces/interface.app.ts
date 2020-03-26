export enum EExitCodes {
    normal = 0,
    update = 131,
    restart = 132,
}
export interface IApplication {
    init: () => Promise<any>;
    destroy: (code: EExitCodes) => Promise<void>;
}
