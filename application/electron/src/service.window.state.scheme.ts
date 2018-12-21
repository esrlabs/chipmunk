export interface IWindowState {
    h: number | undefined;
    max: boolean;
    w: number | undefined;
    x: number | undefined;
    y: number | undefined;
}

export const defaults: IWindowState = {
    h: undefined,
    max: false,
    w: undefined,
    x: undefined,
    y: undefined,
};
