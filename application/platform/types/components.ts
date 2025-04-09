import { FieldLoadingError, StaticFieldDesc } from './bindings';

export interface LoadingDoneEvent {
    owner: string;
    fields: StaticFieldDesc[];
}

export interface LoadingErrorsEvent {
    owner: string;
    errors: FieldLoadingError[];
}

export interface LoadingErrorEvent {
    owner: string;
    error: string;
    fields: string[];
}
export interface LoadingCancelledEvent {
    owner: string;
    fields: string[];
}
