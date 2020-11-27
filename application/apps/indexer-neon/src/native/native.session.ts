import * as Logs from '../util/logging';

import ServiceProduction from '../services/service.production';

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

export class RustSessionChannelDebug extends RustSessionChannel {
    private readonly _logger: Logs.Logger = Logs.getLogger(`RustSessionChannelDebug`);

    constructor() {
        super();
        this._logger.debug(`created`);
    }

    public destroy() {
        this._logger.debug(`destroyed`);
    }

    public grabStreamChunk(start: number, len: number): string {
        let output: string = '';
        for (let i = start; i <= len; i += 1) {
            output += `output: ${i}\n`;
        }
        return output;
    }

    public grabSearchChunk(start: number, len: number): string {
        let output: string = '';
        for (let i = start; i <= len; i += 1) {
            output += `search: ${i}\n`;
        }
        return output;
    }

    public grabMatchesChunk(start: number, len: number): string {
        let output: string = '';
        for (let i = start; i <= len; i += 1) {
            output += `matches: ${i}\n`;
        }
        return output;
    }

    public setSearch(filters: IFilter[]): Error | undefined {
        return undefined;
    }

    public setMatches(filters: IFilter[]): Error | undefined {
        return undefined;
    }

    public getFileOptionsRequirements(filename: string): EFileOptionsRequirements {
        return EFileOptionsRequirements.NoOptionsRequired;
    }

    public getStreamLen(): number {
        return 100000;
    }

    public getSearchLen(): number {
        return 10000;
    }

    public getMatchesLen(): number {
        return 1000;
    }

    public getSocketPath(): string {
        return '';
    }
}

let RustSessionChannelConstructor: RustChannelConstructorImpl<RustSessionChannel>;

if (ServiceProduction.isProd()) {
    RustSessionChannelConstructor = RustSessionChannelNoType;
} else {
    RustSessionChannelConstructor = RustSessionChannelDebug;
}

export { RustSessionChannelConstructor };
