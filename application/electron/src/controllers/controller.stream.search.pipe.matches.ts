import * as Stream from 'stream';
import Logger from '../tools/env.logger';

export default class Transform extends Stream.Transform {

    private _logger: Logger;
    private _rest: string = '';
    private _request: RegExp;
    private _map: { [key: number]: string } = {};
    private _stats: { [key: string]: number } = {};
    private _keys: { [key: string]: string } = {};

    constructor(options: Stream.TransformOptions,
                streamId: string,
                requests: RegExp[] | RegExp) {
        super(options);
        this._logger = new Logger(`ControllerSearchTransformer: ${streamId}`);
        if (!(requests instanceof Array)) {
            requests = [requests];
        }
        this._request = new RegExp(`${requests.map((request: RegExp, i: number) => {
            const key: string = `_${i}_`;
            this._keys[key] = request.source;
            return `(?<${key}>${request.source.replace(/\\/gi, '\\')})`;
        }).join('|')}`, 'i');
    }

    public getMap(): { [key: number]: string } {
        return this._map;
    }

    public getStats(): { [key: string]: number } {
        return this._stats;
    }

    public _transform(chunk: Buffer | string, encoding: string, callback: Stream.TransformCallback | undefined): void {
        // Convert to utf8 and insert rest from previos
        let output: string = '';
        if (typeof chunk === 'string') {
            output = `${this._rest}${chunk}`;
        } else {
            output = `${this._rest}${chunk.toString('utf8')}`;
        }
        // Get rest from the end
        const rest = this._getRest(output);
        this._rest = rest.rest;
        output = rest.cleared;
        // Get lines
        const lines: string[] = output.split(/[\n\r]/gi);
        lines.forEach((line: string) => {
            this._request.lastIndex = 0;
            const requestsMatch: RegExpExecArray | null = this._request.exec(line);
            const numberMatch: RegExpMatchArray | null = line.match(/\u0002(\d*)\u0002$/i);
            if (requestsMatch === null || numberMatch === null || numberMatch.length !== 2) {
                return;
            }
            if (requestsMatch.groups === undefined) {
                return;
            }
            const position: number = parseInt(numberMatch[1], 10);
            if (isNaN(position) || !isFinite(position)) {
                return;
            }
            Object.keys(requestsMatch.groups).forEach((key: string, i: number) => {
                if ((requestsMatch.groups as any)[key] !== undefined) {
                    this._map[position] = this._getKey(key);
                    this._setStats(this._getKey(key));
                }
            });
        });
        // Call callback
        if (callback !== undefined) {
            callback(undefined, output);
        }
    }

    private _getRest(str: string): { rest: string, cleared: string } {
        const last = str.length - 1;
        for (let i = last; i >= 0; i -= 1) {
            if (str[i] === '\n' && i > 0) {
                return {
                    rest: str.substr(i + 1, last),
                    cleared: str.substr(0, i + 1),
                };
            }
        }
        return { rest: '', cleared: str };
    }

    private _setStats(key: string) {
        let current: number | undefined = this._stats[key];
        if (current === undefined) {
            current = 0;
        }
        this._stats[key] = current + 1;
    }

    private _getKey(key: string): string {
        return this._keys[key];
    }

}
