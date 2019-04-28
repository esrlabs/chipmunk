import { AFileParser } from './interface';
import { Transform } from 'stream';
import * as dlt from 'dltreader';
import * as path from 'path';

const ExtNames = ['dlt'];

export default class FileParser extends AFileParser {

    public getName(): string {
        return 'DLT format';
    }

    public getExtnameFilters(): Array<{ name: string, extensions: string[] }> {
        return [
            { name: 'DLT Files', extensions: ExtNames },
        ];
    }

    public isSupported(file: string): boolean {
        const extname: string = path.extname(file).toLowerCase();
        return ExtNames.indexOf(extname) !== -1;
    }

    public getTransform(): Transform | undefined {
        return new dlt.TransformStream({}, { stringify: true });
    }

}
