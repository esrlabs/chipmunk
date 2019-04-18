import { dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import ServiceStreams from '../../services/service.streams';
import ServiceStreamSource from '../../services/service.stream.sources';

import * as Tools from '../../tools/index';

export default class FunctionOpenFile {

    public static getLabel(): string {
        return 'Open Local File';
    }

    public static handler(): () => void {
        return () => {
            dialog.showOpenDialog({
                properties: ['openFile', 'showHiddenFiles'],
            }, (files: string[]) => {
                if (!(files instanceof Array) || files.length !== 1) {
                    return;
                }
                const file: string = files[0];
                fs.stat(file, (error: NodeJS.ErrnoException, stats: fs.Stats) => {
                    if (error) {
                        return;
                    }
                    // Add new description of source
                    const sourceId: number = ServiceStreamSource.add({ name: path.basename(file) });
                    // Create read stream
                    const stream: fs.ReadStream = fs.createReadStream(file);
                    const pipeSessionId: string = Tools.guid();
                    ServiceStreams.addPipeSession(pipeSessionId, stats.size, file);
                    ServiceStreams.pipeWith(stream, sourceId).then(() => {
                        ServiceStreams.removePipeSession(pipeSessionId);
                        stream.close();
                    });
                });
            });
        };
    }

}
