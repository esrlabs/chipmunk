export interface IEventData {
    type: string;
    data: string | undefined;
}

export type TEventData = string | Required<IEventData>;

export type TEventEmitter = (event: TEventData) => void;
