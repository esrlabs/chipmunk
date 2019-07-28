import { AControllerFileOptions } from '../../interfaces/interface.controller.file.options';
import { IPCMessages } from '../../services/service.electron.ipc';
import { DialogsFileOptionsDltComponent } from '../../components/dialogs/file.options.dlt/component';
import TabsSessionsService from '../../services/service.sessions.tabs';
import LayoutStateService from '../../services/standalone/service.layout.state';
import PopupsService, { IPopup } from '../../services/standalone/service.popups';

export class ControllerDltFileOptions extends AControllerFileOptions {

    public getOptions(request: IPCMessages.FileGetOptionsRequest): Promise<any> {
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
                        onDone: (options: any) => {
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
