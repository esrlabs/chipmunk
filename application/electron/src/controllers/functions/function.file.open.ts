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
                    const close = () => {
                        stream.close();
                    };
                    if (error) {
                        return;
                    }
                    // Create read stream
                    const stream: fs.ReadStream = fs.createReadStream(file, { highWaterMark: 256 * 1024 });
                    const pipeSessionId: string = Tools.guid();
                    ServiceStreams.addPipeSession(pipeSessionId, stats.size, file);
                    stream.on('data', (chunk: Buffer) => {
                        ServiceStreams.writeTo(chunk);
                    });
                    stream.on('end', () => {
                        ServiceStreams.removePipeSession(pipeSessionId);
                    });
                });
                // files[0]
            });
        };
    }

}
