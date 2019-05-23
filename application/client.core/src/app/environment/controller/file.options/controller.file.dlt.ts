import { AControllerFileOptions } from '../../interfaces/interface.controller.file.options';
import { IPCMessages } from '../../services/service.electron.ipc';
import { DialogsFileOptionsDltComponent } from '../../components/sidebar/dialogs/file.options.dlt/component';
import TabsSessionsService from '../../services/service.sessions.tabs';
import LayoutStateService from '../../services/standalone/service.layout.state';

export class ControllerDltFileOptions extends AControllerFileOptions {

    public getOptions(request: IPCMessages.FileGetOptionsRequest): Promise<any> {
        return new Promise((resolve, reject) => {
            // Show sidebar
            LayoutStateService.sidebarMax();
            const guid: string | Error = TabsSessionsService.addSidebarApp(
                'DLT File Opening',
                DialogsFileOptionsDltComponent,
                {
                    fileName: request.fileName,
                    fullFileName: request.fullFileName,
                    size: request.size,
                    onDone: (options: any) => {
                        TabsSessionsService.removeSidebarApp(guid as string);
                        LayoutStateService.sidebarMin();
                        resolve(options);
                    },
                    onCancel: () => {
                        TabsSessionsService.removeSidebarApp(guid as string);
                        LayoutStateService.sidebarMin();
                        reject(new Error(`Cancel opening file`));
                    }
                }
            );
        });
    }

}
