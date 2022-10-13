import * as FileDlt from './file.dlt';
import * as FileText from './file.text';
import * as FilePcap from './file.pcap';
import * as FileAny from './file.any';
import * as StreamDltOnCustom from './stream.dlt.custom';
import * as StreamTextOnCustom from './stream.text.custom';
import { Base } from './action';

export * as FileDlt from './file.dlt';
export * as FileText from './file.text';
export * as FilePcap from './file.pcap';
export * as FileAny from './file.any';
export * as StreamDltOnCustom from './stream.dlt.custom';
export * as StreamTextOnCustom from './stream.text.custom';

export { Base } from './action';

export const all = [
    [FileDlt.ACTION_UUID, FileDlt.Action],
    [FileText.ACTION_UUID, FileText.Action],
    [FilePcap.ACTION_UUID, FilePcap.Action],
    [FileAny.ACTION_UUID, FileAny.Action],
    [StreamDltOnCustom.ACTION_UUID, StreamDltOnCustom.Action],
    [StreamTextOnCustom.ACTION_UUID, StreamTextOnCustom.Action],
];
export function getActionByUuid(uuid: string): Base | undefined {
    const action = all.find((d) => d[0] === uuid);
    return action === undefined ? undefined : new (action[1] as { new (): Base })();
}
