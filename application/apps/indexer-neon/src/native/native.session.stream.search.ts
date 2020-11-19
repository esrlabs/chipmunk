import { RustChannelRequiered } from './native.channel.required';
import { RustSearchOperationChannelNoType } from './native';
import { IFilter } from '../interfaces/index';

// Create abstract class to declare available methods
export abstract class RustSearchOperationChannel extends RustChannelRequiered {
    public abstract search(session: string, filters: IFilter[]): void;
}

// Create a type for constructor, because abstract class doesn't have constructor
export type RustSearchOperationChannelConstructorImpl = new () => RustSearchOperationChannel;

// Assing type
export const RustSearchOperationChannelConstructor: RustSearchOperationChannelConstructorImpl = RustSearchOperationChannelNoType;
