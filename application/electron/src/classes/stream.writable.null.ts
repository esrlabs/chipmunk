import * as Stream from 'stream';

export default class NullWritableStream extends Stream.Writable {

    constructor() {
        super({});
    }

    public _write(chunk: Buffer | string, encoding: string, callback: () => any) {
        callback();
    }

}
