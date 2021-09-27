import { AControllerFileOptions } from '../../interfaces/interface.controller.file.options';
import { IPC } from '../../services/service.electron.ipc';
import { DialogsFileOptionsDltComponent } from '../../components/dialogs/file.options.dlt/component';
import PopupsService from '../../services/standalone/service.popups';
import { CommonInterfaces } from '../../interfaces/interface.common';
import * as Toolkit from 'chipmunk.client.toolkit';

export class ControllerDltFileOptions extends AControllerFileOptions {
    public getOptions(
        request: IPC.FileGetOptionsRequest,
    ): Promise<CommonInterfaces.DLT.IDLTOptions> {
        return new Promise((resolve, reject) => {
            const guid: string | undefined = PopupsService.add({
                id: 'dlt-options-dialog',
                options: {
                    closable: false,
                    width: 40,
                },
                caption: `Opening ${request.fileName} ${(request.size / 1024 / 1024).toFixed(2)}Mb`,
                component: {
                    factory: DialogsFileOptionsDltComponent,
                    inputs: {
                        fileName: request.fileName,
                        fullFileName: request.fullFileName,
                        size: request.size,
                        onDone: (options: CommonInterfaces.DLT.IDLTOptions) => {
                            guid !== undefined && PopupsService.remove(guid);
                            resolve(options);
                        },
                        onDefaultCancelAction: () => {
                            guid !== undefined && PopupsService.remove(guid);
                            reject(new Error(`Cancel opening file`));
                        },
                    },
                },
            });
        });
    }

    public reopen(
        file: string,
        options: CommonInterfaces.DLT.IDLTOptions,
    ): Promise<CommonInterfaces.DLT.IDLTOptions> {
        return new Promise((resolve, reject) => {
            const guid: string | undefined = PopupsService.add({
                id: 'dlt-options-dialog-reopen',
                options: {
                    closable: false,
                    width: 40,
                },
                caption: `Reopening ${Toolkit.basename(file)}`,
                component: {
                    factory: DialogsFileOptionsDltComponent,
                    inputs: {
                        fileName: Toolkit.basename(file),
                        fullFileName: file,
                        options: options,
                        onDone: (opts: CommonInterfaces.DLT.IDLTOptions) => {
                            guid !== undefined && PopupsService.remove(guid);
                            resolve(opts);
                        },
                        onDefaultCancelAction: () => {
                            guid !== undefined && PopupsService.remove(guid);
                            reject(new Error(`Cancel reopening file`));
                        },
                    },
                },
            });
        });
    }
}
