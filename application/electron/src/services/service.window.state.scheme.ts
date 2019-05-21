export interface IWindowState {
    h: number | undefined;
    max: boolean;
    w: number | undefined;
    x: number | undefined;
    y: number | undefined;
}

export const defaults: IWindowState = {
    h: 500,
    max: false,
    w: 900,
    x: 100,
    y: 100,
};
