import { AFileParser, IFileParserFunc, IMapItem } from './interface';
import { Transform } from 'stream';
import * as path from 'path';
import { Lvin, IIndexResult, IFileMapItem } from 'logviewer.lvin';

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
        const extname: string = path.extname(file).toLowerCase().replace('.', '');
        return ExtNames.indexOf(extname) !== -1;
    }

    public getTransform(): Transform | undefined {
        // Do not need any transform operations
        return undefined;
    }

    public getParserFunc(): IFileParserFunc {
        return {
            parse: (chunk: Buffer) => {
                return new Promise((resolve) => {
                    resolve(chunk);
                });
            },
            close: () => {
                // Do nothing
            },
            rest: () => {
                // Do nothing
                return '';
            },
        };
    }

    public readAndWrite(srcFile: string, destFile: string, sourceId: string, updateBytesReadState?: (bytes: number) => void): Promise<IMapItem[]> {
        return new Promise((resolve, reject) => {
            const lvin: Lvin = new Lvin();
            if (updateBytesReadState !== undefined) {
                lvin.on(Lvin.Events.progress, (bytes: number) => {
                    updateBytesReadState(bytes);
                });
            }
            lvin.index({
                srcFile: srcFile,
                destFile: destFile,
                injection: sourceId.toString(),
            }).then((results: IIndexResult) => {
                lvin.removeAllListeners();
                resolve(results.map.map((item: IFileMapItem) => {
                    return { rows: { from: item.r[0], to: item.r[1] }, bytes: { from: item.b[0], to: item.b[1] }};
                }));
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

}
