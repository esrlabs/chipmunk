// tslint:disable: callable-types
import { Session } from 'indexer-neon';

export type DependencyConstructor<T> = new (session: Session) => Dependency & T;

export abstract class Dependency {

    public abstract init(): Promise<void>;
    public abstract destroy(): Promise<void>;
    public abstract getName(): string;

}