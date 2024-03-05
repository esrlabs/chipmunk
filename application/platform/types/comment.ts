export interface SelectionPoint {
    position: number;
    offset: number;
    text: string;
}

export interface CommentedSelection {
    start: SelectionPoint;
    end: SelectionPoint;
    text: string;
}

export enum CommentState {
    done = 'done',
    pending = 'pending',
}

export interface Response {
    uuid: string;
    comment: string;
    created: number;
    modified: number;
}

export interface CommentDefinition {
    uuid: string;
    state: CommentState;
    comment: string;
    created: number;
    modified: number;
    responses: Response[];
    color: string | undefined;
    selection: CommentedSelection;
}
