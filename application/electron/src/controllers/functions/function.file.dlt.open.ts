import { dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as dlt from 'dltreader';
import ServiceStreams from '../../services/service.streams';
import ServiceStreamSource from '../../services/service.stream.sources';

import * as Tools from '../../tools/index';

export default class FunctionOpenDltFile {

    public static getLabel(): string {
        return 'Open Local Dlt File';
    }

    public static handler(): () => void {
        return () => {
            dialog.showOpenDialog({
                properties: ['openFile', 'showHiddenFiles'],
                filters: [ { name: 'Dlt Files', extensions: ['dlt'] } ],
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
                    // Create transformer
                    const tranform: dlt.TransformStream = new dlt.TransformStream({}, { stringify: true });
                    // Define pipe session Id
                    const pipeSessionId: string = Tools.guid();
                    // Registe pipe session id
                    ServiceStreams.addPipeSession(pipeSessionId, stats.size, file);
                    // Connect to active session stream
                    ServiceStreams.pipeWith({
                        reader: reader,
                        sourceId: sourceId,
                        decoder: tranform,
                    }).then(() => {
                        ServiceStreams.removePipeSession(pipeSessionId);
                        reader.close();
                    });
                });
            });
        };
    }

}
