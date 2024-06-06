import { Define, Implementation, Interface } from 'platform/entity/controller';
import { services } from '@register/services';
import { BrowserWindow } from 'electron';
import { system } from 'platform/modules/system';
import { dialog } from 'electron';

@Define({ name: 'Dialogs', parent: services['electron'], accessor: system.getServicesAccessor() })
export class Dialogs extends Implementation {
    private _window!: BrowserWindow;

    protected fixFocusAndMouse(): void {
        // On linux system (with GNOME) in some cases after system dialog
        // has been shown, mouse is locked for whole system. With minimum
        // timeout (after dialog inited) we should manualy unlock mouse
        // and focus to the dialog
        if (process.platform !== 'linux') {
            return;
        }
        setTimeout(() => {
            this._window.setEnabled(true);
            this._window.blur();
        });
    }
    public bind(window: BrowserWindow): void {
        this._window = window;
    }

    public saveFile(ext?: string): Promise<string | undefined> {
        this.fixFocusAndMouse();
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
        this.fixFocusAndMouse();
        const result = await dialog.showOpenDialog(this._window, {
            title: 'Opening a folder',
            properties: ['openDirectory', 'multiSelections'],
        });
        return Promise.resolve(result.canceled ? [] : result.filePaths);
    }

    public openFile(): {
        any(ext?: string): Promise<string[]>;
        dlt(): Promise<string[]>;
        pcapng(): Promise<string[]>;
        pcap(): Promise<string[]>;
    } {
        const opener = async (target: number, ext?: string): Promise<string[]> => {
            let results;
            this.fixFocusAndMouse();
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
                        title: 'Opening a PCAPNG file',
                        properties: ['openFile', 'multiSelections'],
                        filters: [{ name: 'PCAPNG Files', extensions: ['pcapng'] }],
                    });
                    break;
                case 3:
                    results = await dialog.showOpenDialog(this._window, {
                        title: 'Opening a PCAP file',
                        properties: ['openFile', 'multiSelections'],
                        filters: [{ name: 'PCAP Files', extensions: ['pcap'] }],
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
            pcapng: () => opener(2),
            pcap: () => opener(3),
        };
    }
}
export interface Dialogs extends Interface {}
