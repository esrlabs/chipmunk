import { RustChannelRequiered } from './native.channel.required';
import { RustSessionChannelNoType } from './native';

// Create abstract class to declare available methods
export abstract class RustSessionChannel extends RustChannelRequiered {
    public abstract grabStream(line_index: number, line_count: number): string;
    public abstract grabSearch(line_index: number, line_count: number): string;
    public abstract getStreamLen(): number;
    public abstract getSearchLen(): number;
    public abstract getSocketPath(): string;
}

// Create a type for constructor, because abstract class doesn't have constructor
export type RustSessionChannelConstructorImpl = new () => RustSessionChannel;

export const RustSessionChannelConstructor: RustSessionChannelConstructorImpl = RustSessionChannelNoType;
