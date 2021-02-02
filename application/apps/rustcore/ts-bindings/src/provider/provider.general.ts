export interface IEventData {
    [key: string]: any;
}

export type TEventData = string | Required<IEventData>;

export type TEventEmitter = (event: TEventData) => void;
