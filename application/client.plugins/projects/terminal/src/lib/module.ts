import { NgModule } from '@angular/core';
import { ViewComponent } from './view/component';
import {CommonModule} from '@angular/common';

@NgModule({
    entryComponents: [ViewComponent],
    declarations: [ViewComponent],
    imports: [ CommonModule ],
    exports: [ViewComponent]
})

export class PluginModule {

    private _api: string | undefined;

    public setAPI(api: any) {
        this._api = api;
    }

}
