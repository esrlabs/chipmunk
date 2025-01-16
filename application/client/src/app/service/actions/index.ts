import * as FileDlt from './file.dlt';
import * as FileText from './file.text';
import * as FilePcap from './file.pcapng';
import * as FilePcapLegacy from './file.pcap';
import * as FilePlugins from './file.plugins';
import * as FileAny from './file.any';
import * as FolderDlt from './folder.dlt';
import * as FolderText from './folder.text';
import * as FolderPcap from './folder.pcapng';
import * as FolderPcapLegacy from './folder.pcap';
import * as FolderPlugins from './folder.plugins';
import * as FolderAny from './folder.any';
import * as UdpDlt from './udp.dlt';
import * as TcpDlt from './tcp.dlt';
import * as SerialText from './serial.text';
import * as StdoutText from './stdout.text';
import * as About from './about';
import * as JumpTo from './jumpto';
import * as Updates from './updates';
import * as Settings from './settings';
import * as Exit from './exit';
import * as Help from './help';
import * as PluginsManager from './plugins_manager';
import * as StdoutPlugin from './stdout.plugin';

import { Base } from './action';

export * as FileDlt from './file.dlt';
export * as FileText from './file.text';
export * as FilePcap from './file.pcapng';
export * as FilePcapLegacy from './file.pcap';
export * as FilePlugins from './file.plugins';
export * as FileAny from './file.any';
export * as FolderDlt from './folder.dlt';
export * as FolderText from './folder.text';
export * as FolderPcap from './folder.pcapng';
export * as FolderPcapLegacy from './folder.pcap';
export * as FolderPlugins from './folder.plugins';
export * as FolderAny from './folder.any';
export * as UdpDlt from './udp.dlt';
export * as TcpDlt from './tcp.dlt';
export * as SerialText from './serial.text';
export * as StdoutText from './stdout.text';
export * as About from './about';
export * as JumpTo from './jumpto';
export * as Updates from './updates';
export * as Settings from './settings';
export * as Exit from './exit';
export * as Help from './help';
export * as PluginsManager from './plugins_manager';
export * as StdoutPlugin from './stdout.plugin';

export { Base } from './action';

export const all = [
    [FileDlt.ACTION_UUID, FileDlt.Action],
    [FileText.ACTION_UUID, FileText.Action],
    [FilePcap.ACTION_UUID, FilePcap.Action],
    [FilePcapLegacy.ACTION_UUID, FilePcapLegacy.Action],
    [FilePlugins.ACTION_UUID, FilePlugins.Action],
    [FileAny.ACTION_UUID, FileAny.Action],
    [FolderDlt.ACTION_UUID, FolderDlt.Action],
    [FolderText.ACTION_UUID, FolderText.Action],
    [FolderPcap.ACTION_UUID, FolderPcap.Action],
    [FolderPcapLegacy.ACTION_UUID, FolderPcapLegacy.Action],
    [FolderPlugins.ACTION_UUID, FolderPlugins.Action],
    [FolderAny.ACTION_UUID, FolderAny.Action],
    [UdpDlt.ACTION_UUID, UdpDlt.Action],
    [TcpDlt.ACTION_UUID, TcpDlt.Action],
    [SerialText.ACTION_UUID, SerialText.Action],
    [StdoutText.ACTION_UUID, StdoutText.Action],
    [About.ACTION_UUID, About.Action],
    [JumpTo.ACTION_UUID, JumpTo.Action],
    [Updates.ACTION_UUID, Updates.Action],
    [Settings.ACTION_UUID, Settings.Action],
    [Help.ACTION_UUID, Help.Action],
    [Exit.ACTION_UUID, Exit.Action],
    [PluginsManager.ACTION_UUID, PluginsManager.Action],
    [StdoutPlugin.ACTION_UUID, StdoutPlugin.Action],
];

export function getActionByUuid(uuid: string): Base | undefined {
    const action = all.find((d) => d[0] === uuid);
    return action === undefined ? undefined : new (action[1] as { new (): Base })();
}
