import { AControllerFileOptions } from '../../interfaces/interface.controller.file.options';
import { IPCMessages } from '../../services/service.electron.ipc';
import { DialogsFileOptionsDltComponent } from '../../components/dialogs/file.options.dlt/component';
import PopupsService from '../../services/standalone/service.popups';
import { CommonInterfaces } from '../../interfaces/interface.common';

export class ControllerDltFileOptions extends AControllerFileOptions {

    public getOptions(request: IPCMessages.FileGetOptionsRequest): Promise<CommonInterfaces.DLT.IDLTOptions> {
        return new Promise((resolve, reject) => {
            const guid: string = PopupsService.add({
                options: {
                    closable: false,
                    width: 30,
                },
                caption: `Opening ${request.fileName}`,
                component: {
                    factory: DialogsFileOptionsDltComponent,
                    inputs: {
                        fileName: request.fileName,
                        fullFileName: request.fullFileName,
                        size: request.size,
                        onDone: (options: CommonInterfaces.DLT.IDLTOptions) => {
                            PopupsService.remove(guid);
                            resolve(options);
                        },
                        onCancel: () => {
                            PopupsService.remove(guid);
                            reject(new Error(`Cancel opening file`));
                        }
                    }
                }
            });
        });
    }

}
