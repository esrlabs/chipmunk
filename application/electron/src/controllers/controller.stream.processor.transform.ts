import * as Stream from 'stream';

export interface IRange {
    from: number;
    to: number;
}

export interface IRangeMapItem {
    rows: IRange;
    bytes: IRange;
}

const MARKERS = {
    PLUGIN: '\u0003',
    NUMBER: '\u0002',
};

export default class Transform extends Stream.Transform {

    private _pluginId: number = 0;
    private _rows: number = 0;
    private _bytes: number = 0;
    private _rest: string = '';
    private _map: IRangeMapItem[] = [];

    constructor(options: Stream.TransformOptions) {
        super(options);
    }

    public _transform(chunk: Buffer, encoding: string, callback: Stream.TransformCallback) {
        // Convert to utf8 and insert rest from previos
        let output: string = '';
        if (typeof chunk === 'string') {
            output = `${this._rest}${chunk}`;
        } else {
            output = `${this._rest}${chunk.toString('utf8')}`;
        }
        // Get rest from the end
        this._rest = this._getRest(output);
        // Remove rest from current chunk
        output = this._removeRest(output);
        // Add indexes
        const rows: IRange = {
            from: this._rows,
            to: -1,
        };
        // Store cursor position
        const bytes = {
            from: this._bytes,
            to: -1,
        };
        output = output.replace(/[\r?\n|\r]/gi, () => {
            return `\u0003${this._pluginId}\u0003\u0002${this._rows++}\u0002\n`;
        });
        const size: number = Buffer.byteLength(output, 'utf8');
        rows.to = this._rows;
        bytes.to = this._bytes + size - 1;
        this._map.push({
            rows: rows,
            bytes: bytes,
        });
        callback(undefined, output);
    }

    private _getRest(str: string): string {
        const match: RegExpMatchArray | null = str.match(/[^\n\r]*$/g);
        if (match === null || match.length !== 1) {
            return '';
        }
        return match[0];
    }

    private _removeRest(str: string): string {
        return str.replace(/[^\n\r]*$/g, '');
    }

}
