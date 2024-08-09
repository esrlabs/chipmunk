export interface IEventData {
    [key: string]: any;
}

export type TEventData = number[] | Required<IEventData>;

export type TEventEmitter = (event: TEventData) => void;
