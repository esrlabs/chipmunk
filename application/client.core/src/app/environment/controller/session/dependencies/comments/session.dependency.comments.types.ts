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

export enum ECommentState {
    done = 'done',
    pending = 'pending',
}

export interface ICommentResponse {
    guid: string;
    comment: string;
    created: number;
    modified: number;
}

export interface IComment {
    guid: string;
    state: ECommentState;
    comment: string;
    created: number;
    modified: number;
    responses: ICommentResponse[];
    color: string | undefined;
    selection: ICommentedSelection;
}

export interface IActualSelectionData {
    selection: string;
    start: number;
    end: number;
}
