import { RustChannelRequiered } from './native.channel.required';
import { RustSessionChannelNoType } from './native';
import { IFilter } from '../interfaces/index';
import { EFileOptionsRequirements } from './native.session.stream.append';
import { RustChannelConstructorImpl } from './native';

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

export const RustSessionChannelConstructor: RustChannelConstructorImpl<RustSessionChannel> = RustSessionChannelNoType;

/**
 open file workflow
  - FE -> BE: what is this file about?: is it text/ is it dlt ...
  - BE - FE: this is DLT, open options
  - FE: opens options and wait for user
  - FE -> BE: filename + options to open
  - BE: opens file
 
 */