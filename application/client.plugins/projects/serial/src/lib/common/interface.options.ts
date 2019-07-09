export interface IPortOptions {
    autoOpen?: boolean;
    baudRate?: 115200|57600|38400|19200|9600|4800|2400|1800|1200|600|300|200|150|134|110|75|50|number;
    dataBits?: 8|7|6|5;
    highWaterMark?: number;
    lock?: boolean;
    stopBits?: 1|2;
    parity?: 'none'|'even'|'mark'|'odd'|'space';
    rtscts?: boolean;
    xon?: boolean;
    xoff?: boolean;
    xany?: boolean;
    // binding?: BaseBinding;
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

export const COptionsLabes = {
    baudRate: 'Baud rate',
    lock: 'Lock port',
    dataBits: 'Data bits',
    highWaterMark: 'High water mark',
    stopBits: 'Stop bits',
    parity: 'Parity',
    rtscts: 'RTSCTS',
    xon: 'xON',
    xoff: 'xOFF',
    xany: 'xANY',
    delimiter: 'Delimiter',
    encoding: 'Encoding',
    includeDelimiter: 'Including delimiter',
};

export const CDefaultOptions: IOptions = {
    path: '',
    options: {
        baudRate: 921600,
        lock: false,
        dataBits: 8,
        highWaterMark: 65536,
        stopBits: 1,
        parity: 'none',
        rtscts: false,
        xon: false,
        xoff: false,
        xany: false,
    },
    reader: {
        delimiter: '\n',
        encoding: 'utf8',
        includeDelimiter: false,
    }
};

