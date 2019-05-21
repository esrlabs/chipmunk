import { AFileParser, IFileParserFunc } from './interface';
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
        const extname: string = path.extname(file).toLowerCase().replace('.', '');
        return ExtNames.indexOf(extname) !== -1;
    }

    public getTransform(): Transform | undefined {
        return new dlt.TransformStream({}, { stringify: true, datetime: true });
    }

    public getParserFunc(): IFileParserFunc {
        let transform: dlt.TransformStream | undefined = new dlt.TransformStream({}, { stringify: true, datetime: true });
        return {
            parse: (chunk: Buffer) => {
                return new Promise((resolve, reject) => {
                    if (transform === undefined) {
                        return reject(new Error(`Transform is already closed`));
                    }
                    transform._transform(chunk, 'utf8', (error: Error | undefined, output: string) => {
                        if (error) {
                            return reject(error);
                        }
                        resolve(output);
                    });
                });
            },
            close: () => {
                if (transform === undefined) {
                    return;
                }
                transform.destroy();
                transform = undefined;
            },
            rest: () => {
                // DLT message cannot have a rest part
                return '';
            },
        };
    }

}
