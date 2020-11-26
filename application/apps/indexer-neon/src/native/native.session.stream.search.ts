import { RustChannelRequiered } from './native.channel.required';
import { RustSearchOperationChannelNoType } from './native';
import { IFilter } from '../interfaces/index';
import { RustChannelConstructorImpl } from './native';

// Create abstract class to declare available methods
export abstract class RustSearchOperationChannel extends RustChannelRequiered {
    public abstract search(session: string, filters: IFilter[]): void;
}

// Assing type
export const RustSearchOperationChannelConstructor: RustChannelConstructorImpl<RustSearchOperationChannel> = RustSearchOperationChannelNoType;
