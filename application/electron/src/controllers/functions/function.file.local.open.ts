import { dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import ServiceStreams from '../../services/service.streams';
import ServiceStreamSource from '../../services/service.stream.sources';
import { AFileParser } from '../files.parsers/interface';
import * as Tools from '../../tools/index';

export default class FunctionOpenLocalFile {

    private _parser: AFileParser;

    constructor(parser: AFileParser) {
        this._parser = parser;
    }

    public getLabel(): string {
        return `Open Local file: ${this._parser.getName()}`;
    }

    public getHandler(): () => void {
        return () => {
            dialog.showOpenDialog({
                properties: ['openFile', 'showHiddenFiles'],
                filters: this._parser.getExtnameFilters(),
            }, (files: string[]) => {
                if (!(files instanceof Array) || files.length !== 1) {
                    return;
                }
                const file: string = files[0];
                fs.stat(file, (error: NodeJS.ErrnoException | null, stats: fs.Stats) => {
                    if (error) {
                        return;
                    }
                    // Add new description of source
                    const sourceId: number = ServiceStreamSource.add({ name: path.basename(file) });
                    // Create read stream
                    const reader: fs.ReadStream = fs.createReadStream(file);
                    const pipeSessionId: string = Tools.guid();
                    ServiceStreams.addPipeSession(pipeSessionId, stats.size, file);
                    ServiceStreams.pipeWith({
                        reader: reader,
                        sourceId: sourceId,
                        decoder: this._parser.getTransform(),
                    }).then(() => {
                        ServiceStreams.removePipeSession(pipeSessionId);
                        reader.close();
                    });
                });
            });
        };
    }

}
