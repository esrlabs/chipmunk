import { Define, Implementation, Interface } from '@platform/entity/controller';
import { services } from '@register/services';
import { BrowserWindow } from 'electron';
import { system } from '@platform/modules/system';
import { dialog } from 'electron';

@Define({ name: 'Dialogs', parent: services['electron'], accessor: system.getServicesAccessor() })
export class Dialogs extends Implementation {
    private _window!: BrowserWindow;

    public bind(window: BrowserWindow): void {
        this._window = window;
    }

    public openFile(): {
        any(ext?: string): Promise<string[]>;
        dlt(): Promise<string[]>;
        pcap(): Promise<string[]>;
    } {
        const opener = async (target: number, ext?: string): Promise<string[]> => {
            let results;
            switch (target) {
                case 0:
                    results = await dialog.showOpenDialog(this._window, {
                        title: 'Opening a file',
                        properties: ['openFile', 'multiSelections'],
                        filters:
                            ext !== undefined
                                ? ext.split(',').map((e) => {
                                      return { name: `*.${e}`, extensions: [e] };
                                  })
                                : [{ name: 'All Files', extensions: ['*'] }],
                    });
                    break;
                case 1:
                    results = await dialog.showOpenDialog(this._window, {
                        title: 'Opening a DLT file',
                        properties: ['openFile', 'multiSelections'],
                        filters: [{ name: 'DLT files', extensions: ['dlt'] }],
                    });
                    break;
                case 2:
                    results = await dialog.showOpenDialog(this._window, {
                        title: 'Opening a PCAP/PCAPNG file',
                        properties: ['openFile', 'multiSelections'],
                        filters: [{ name: 'PCAP/PCAPNG Files', extensions: ['pcap', 'pcapng'] }],
                    });
                    break;
                default:
                    throw new Error(`Unsupported opetion for open file dialog`);
            }
            return Promise.resolve(results.canceled ? [] : results.filePaths);
        };
        return {
            any: (ext?: string) => opener(0, ext),
            dlt: () => opener(1),
            pcap: () => opener(2),
        };
    }
}
export interface Dialogs extends Interface {}
