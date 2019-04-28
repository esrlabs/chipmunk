import { AFileParser } from './interface';
import { Transform } from 'stream';
import * as path from 'path';

const ExtNames = ['txt', 'log', 'logs'];

export default class FileParser extends AFileParser {

    public getName(): string {
        return 'text format';
    }

    public getExtnameFilters(): Array<{ name: string, extensions: string[] }> {
        return [
            { name: 'Text files', extensions: ExtNames },
        ];
    }

    public isSupported(file: string): boolean {
        const extname: string = path.extname(file).toLowerCase();
        return ExtNames.indexOf(extname) !== -1;
    }

    public getTransform(): Transform | undefined {
        // Do not need any transform operations
        return undefined;
    }
}
