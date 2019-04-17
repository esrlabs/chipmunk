import { dialog } from 'electron';
import * as fs from 'fs';
import ServiceStreams from '../../services/service.streams';
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
                    // Create read stream
                    const stream: fs.ReadStream = fs.createReadStream(file);
                    const pipeSessionId: string = Tools.guid();
                    ServiceStreams.addPipeSession(pipeSessionId, stats.size, file);
                    ServiceStreams.pipeWith(stream).then(() => {
                        ServiceStreams.removePipeSession(pipeSessionId);
                        stream.close();
                    });
                });
            });
        };
    }

}
