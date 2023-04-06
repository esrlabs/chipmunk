import { TEventEmitter } from '../provider/provider.general';

export abstract class TrackerNative {
    public abstract init(callback: TEventEmitter): Promise<void>;
    public abstract destroy(): Promise<void>;
    public abstract stats(): Promise<string>;
}
