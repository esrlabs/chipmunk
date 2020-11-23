import { RustChannelRequiered } from './native.channel.required';
import { RustSessionChannelNoType } from './native';
import { IFilter } from '../interfaces/index';
import { EFileOptionsRequirements } from './native.session.stream.append';

// Create abstract class to declare available methods
export abstract class RustSessionChannel extends RustChannelRequiered {
    public abstract grabStreamChunk(start: number, len: number): string;
    public abstract grabSearchChunk(start: number, len: number): string;
    public abstract grabMatchesChunk(start: number, len: number): string;
    public abstract setSearch(filters: IFilter[]): Error | undefined;
    public abstract setMatches(filters: IFilter[]): Error | undefined;
    public abstract getFileOptionsRequirements(filename: string): EFileOptionsRequirements;
    public abstract getStreamLen(): number;
    public abstract getSearchLen(): number;
    public abstract getMatchesLen(): number;
    public abstract getSocketPath(): string;
}

// Create a type for constructor, because abstract class doesn't have constructor
export type RustSessionChannelConstructorImpl = new () => RustSessionChannel;

export const RustSessionChannelConstructor: RustSessionChannelConstructorImpl = RustSessionChannelNoType;
