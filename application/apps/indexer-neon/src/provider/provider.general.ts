export interface IEventData {
    [key: string]: string | undefined;
}

export type TEventData = string | Required<IEventData>;

export type TEventEmitter = (event: TEventData) => void;
