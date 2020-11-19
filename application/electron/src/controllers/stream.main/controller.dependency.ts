// tslint:disable: callable-types
import { Session } from 'indexer-neon';
import { Channel } from './controller.channel';

export type DependencyConstructor<T> = new (session: Session, channel: Channel) => Dependency & T;

export abstract class Dependency {

    public abstract init(): Promise<void>;
    public abstract destroy(): Promise<void>;
    public abstract getName(): string;

}