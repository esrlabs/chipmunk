import { Define, Implementation, Interface } from 'platform/entity/controller';
import { services } from '@register/services';
import { BrowserWindow } from 'electron';
import { system } from 'platform/modules/system';
import { dialog } from 'electron';

@Define({ name: 'Dialogs', parent: services['electron'], accessor: system.getServicesAccessor() })
export class Dialogs extends Implementation {
    private _window!: BrowserWindow;

    public bind(window: BrowserWindow): void {
        this._window = window;
    }

    public saveFile(ext?: string): Promise<string | undefined> {
        return dialog
            .showSaveDialog(this._window, {
                title: 'Select file to save',
                properties: ['createDirectory', 'showOverwriteConfirmation'],
                filters:
                    ext !== undefined
                        ? ext.split(',').map((e) => {
                              return { name: `*.${e}`, extensions: [e] };
                          })
                        : [{ name: 'All Files', extensions: ['*'] }],
            })
            .then((result: Electron.SaveDialogReturnValue) => {
                return result.filePath === undefined
                    ? result.filePath
                    : result.filePath.trim() === ''
                    ? undefined
                    : result.filePath;
            });
    }

    public async openFolder(): Promise<string[]> {
        // Note: On Windows and Linux an open dialog can not be both a file selector and a directory selector,
        // so if you set properties to ['openFile', 'openDirectory'] on these platforms, a directory selector
        // will be shown.
        const result = await dialog.showOpenDialog(this._window, {
            title: 'Opening a folder',
            properties: ['openDirectory', 'multiSelections'],
        });
        return Promise.resolve(result.canceled ? [] : result.filePaths);
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
                                ? [
                                      { name: 'All Files', extensions: ['*'] },
                                      ...ext.split(',').map((e) => {
                                          return { name: `*.${e}`, extensions: [e] };
                                      }),
                                  ]
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
