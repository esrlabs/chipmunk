import { EventEmitter } from 'events';
import Logger from '../tools/env.logger';

export type THandler = (rows: string) => Promise<void>;
export interface IChunk {
    streamId: string;
    output: string;
    pluginId: number;
    pluginToken: string;
}

const REGEXPS = {
    CARRETS: /[\r?\n|\r]/gi,
    CLOSE_CARRET: /(\r?\n|\r)$/gi,
    PLUGIN_ID: /\u0003(\d*)\u0003/gi,
    REST: /.[^\n\r]*$/gi,
};

const PLUGINID_MARKER = '\u0003';

// TODO: add markers of line numbers here to make search faster

export default class ControllerStreamBuffer extends EventEmitter {

    public static Events = {
        next: 'next',
    };

    private _logger: Logger = new Logger('ControllerStreamBuffer');
    private _size: number;
    private _handler: THandler;
    private _last: IChunk | undefined;
    private _output: string = '';
    private _timer: any;

    constructor(handler: THandler, size: number = 1 * 1024 * 1024 * 20) {
        super();
        this._size = size;
        this._handler = handler;
    }

    public write(chunk: IChunk) {
        // Drop timer
        clearTimeout(this._timer);
        // Clear chunk
        chunk.output = chunk.output.replace(REGEXPS.CARRETS, '\n').replace(/\n{2,}/g, '\n');
        // Check: is it same plugin (transport)
        if (this._last !== undefined && this._last.pluginId !== chunk.pluginId) {
            if (this._output.search(REGEXPS.CLOSE_CARRET) !== -1) {
                // Do not need to add signature, because no rest part of output
            } else {
                // Add carret, because transport is new
                this._output += `${this._injectPluginId('\n', this._last.pluginId)}`;
            }
        }
        // Save last
        this._last = { pluginId: chunk.pluginId, pluginToken: chunk.pluginToken, output: '', streamId: chunk.streamId };
        // Add plugin data
        chunk.output = this._injectPluginId(chunk.output, chunk.pluginId);
        // Attach data to common output
        this._output += chunk.output;
        // Wait just a bit before write data
        this._wait();
    }

    private _injectPluginId(str: string, pluginId: number): string {
        return str.replace(REGEXPS.CARRETS, `${PLUGINID_MARKER}${pluginId}${PLUGINID_MARKER}\n`);
    }

    private _wait() {
        if (this._output.length >= this._size) {
            return this._next();
        }
        clearTimeout(this._timer);
        this._timer = setTimeout(this._next.bind(this));
    }

    private _next() {
        const rest: string = this._getRest();
        const output: string = this._removeRest();
        this._output = rest;
        this._handler(output).catch((error: Error) => {
            this._logger.warn(`Fail to write output data from buffer due error: ${error.message}`);
        });
    }

    private _getRest(): string {
        const match: RegExpMatchArray | null = this._output.match(REGEXPS.REST);
        if (match === null || match.length !== 1) {
            return '';
        }
        return match[0];
    }

    private _removeRest(): string {
        return this._output.replace(REGEXPS.REST, '');
    }

}
