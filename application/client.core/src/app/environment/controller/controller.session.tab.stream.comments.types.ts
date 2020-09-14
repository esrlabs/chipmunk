export interface ISelectionPoint {
    position: number;
    offset: number;
    text: string;
}

export interface ICommentedSelection {
    start: ISelectionPoint;
    end: ISelectionPoint;
    text: string;
}

export interface IComment {
    guid: string;
    selection: ICommentedSelection;
}

export interface IActualSelectionData {
    selection: string;
    start: number;
    end: number;
}

