import { NgModule } from '@angular/core';
import { ViewComponent } from './view/component';
import ServiceElectronIpc from 'logviewer.client.electron.ipc';
import {CommonModule} from '@angular/common';

@NgModule({
    entryComponents: [ViewComponent],
    declarations: [ViewComponent],
    imports: [ CommonModule ],
    exports: [ViewComponent]
})

export class PluginModule {

    private _token: string | undefined;

    public setPluginHostToken(token: string) {
        this._token = token;
        ServiceElectronIpc.setPluginHostToken(this._token);
    }

}
