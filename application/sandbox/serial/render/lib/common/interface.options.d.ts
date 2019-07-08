export interface IPortOptions {
    autoOpen?: boolean;
    baudRate?: 115200 | 57600 | 38400 | 19200 | 9600 | 4800 | 2400 | 1800 | 1200 | 600 | 300 | 200 | 150 | 134 | 110 | 75 | 50 | number;
    dataBits?: 8 | 7 | 6 | 5;
    highWaterMark?: number;
    lock?: boolean;
    stopBits?: 1 | 2;
    parity?: 'none' | 'even' | 'mark' | 'odd' | 'space';
    rtscts?: boolean;
    xon?: boolean;
    xoff?: boolean;
    xany?: boolean;
    bindingOptions?: {
        vmin?: number;
        vtime?: number;
    };
}
export interface IOptions {
    path: string;
    options: IPortOptions;
    reader: {
        delimiter: string | number[];
        encoding?: 'ascii' | 'utf8' | 'utf16le' | 'ucs2' | 'base64' | 'binary' | 'hex' | undefined;
        includeDelimiter?: boolean | undefined;
    };
}
export declare const COptionsLabes: {
    baudRate: string;
    lock: string;
    dataBits: string;
    highWaterMark: string;
    stopBits: string;
    parity: string;
    rtscts: string;
    xon: string;
    xoff: string;
    xany: string;
    delimiter: string;
    encoding: string;
    includeDelimiter: string;
};
export declare const CDefaultOptions: IOptions;
