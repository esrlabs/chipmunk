import { Session } from '../session';

export type SessionGetter = () => Session;
export type DependencyConstructor<T> = new (
    uuid: string,
    session: SessionGetter /*, channel: Channel*/,
) => Dependency & T;

export abstract class Dependency {
    public abstract init(): Promise<void>;
    public abstract destroy(): Promise<void>;
    public abstract getName(): string;
}
