export enum EDockPosition {
    top = 'top',
    left = 'left',
    right = 'right',
    bottom = 'bottom'
}
export interface IDockPosition {
    position: EDockPosition;
    weight: number;
}

export interface IDock {
    id?: string;
    caption: string;
    position?: IDockPosition;
}

export interface ISubjectResized {
    position: IDockPosition;
    id: string;
}

export interface ISubjectMoved {
    position: IDockPosition;
    id: string;
}

