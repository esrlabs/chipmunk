export enum EDockPosition {
    vertical = 'vertical',
    horizontal = 'horizontal'
}
export interface IDockPosition {
    position: EDockPosition;
    weight: number;
}

export interface IDock {
    id?: string;
    child?: IDock;
    caption: string;
    position?: IDockPosition;
}

export interface IDockContainer {
    id?: string;
    docks: IDock[];
}

export interface IPositionSubject {
    position: IDockPosition;
    id: string;
}
