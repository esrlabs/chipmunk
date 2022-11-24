import * as FileDlt from './file.dlt';
import * as FileText from './file.text';
import * as FilePcap from './file.pcap';
import * as FileAny from './file.any';
import * as FolderDlt from './folder.dlt';
import * as FolderText from './folder.text';
import * as FolderPcap from './folder.pcap';
import * as FolderAny from './folder.any';
import * as StreamDltOnCustom from './stream.dlt.custom';
import * as StreamTextOnCustom from './stream.text.custom';
import * as UdpDlt from './udp.dlt';
import * as TcpDlt from './tcp.dlt';
import * as SerialDlt from './serial.dlt';
import * as SerialText from './serial.text';
import * as StdoutText from './stdout.text';
import * as About from './about';

import { Base } from './action';

export * as FileDlt from './file.dlt';
export * as FileText from './file.text';
export * as FilePcap from './file.pcap';
export * as FileAny from './file.any';
export * as FolderDlt from './folder.dlt';
export * as FolderText from './folder.text';
export * as FolderPcap from './folder.pcap';
export * as FolderAny from './folder.any';
export * as StreamDltOnCustom from './stream.dlt.custom';
export * as StreamTextOnCustom from './stream.text.custom';
export * as UdpDlt from './udp.dlt';
export * as TcpDlt from './tcp.dlt';
export * as SerialDlt from './serial.dlt';
export * as SerialText from './serial.text';
export * as StdoutText from './stdout.text';
export * as About from './about';

export { Base } from './action';

export const all = [
    [FileDlt.ACTION_UUID, FileDlt.Action],
    [FileText.ACTION_UUID, FileText.Action],
    [FilePcap.ACTION_UUID, FilePcap.Action],
    [FileAny.ACTION_UUID, FileAny.Action],
    [FolderDlt.ACTION_UUID, FolderDlt.Action],
    [FolderText.ACTION_UUID, FolderText.Action],
    [FolderPcap.ACTION_UUID, FolderPcap.Action],
    [FolderAny.ACTION_UUID, FolderAny.Action],
    [StreamDltOnCustom.ACTION_UUID, StreamDltOnCustom.Action],
    [StreamTextOnCustom.ACTION_UUID, StreamTextOnCustom.Action],
    [UdpDlt.ACTION_UUID, UdpDlt.Action],
    [TcpDlt.ACTION_UUID, TcpDlt.Action],
    [SerialDlt.ACTION_UUID, SerialDlt.Action],
    [SerialText.ACTION_UUID, SerialText.Action],
    [StdoutText.ACTION_UUID, StdoutText.Action],
    [About.ACTION_UUID, About.Action],
];
export function getActionByUuid(uuid: string): Base | undefined {
    const action = all.find((d) => d[0] === uuid);
    return action === undefined ? undefined : new (action[1] as { new (): Base })();
}
