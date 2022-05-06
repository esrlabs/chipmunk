export enum BackendState {
    Ready = 'Ready',
    Locked = 'Locked',
}

export interface BackendStateEvent {
    state: BackendState;
    job: string;
}
