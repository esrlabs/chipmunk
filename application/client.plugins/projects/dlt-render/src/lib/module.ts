import { NgModule } from '@angular/core';
import { DLTRowComponent } from './views/row/component';
import { CommonModule } from '@angular/common';

@NgModule({
    entryComponents: [ DLTRowComponent],
    declarations: [ DLTRowComponent],
    imports: [ CommonModule ],
    exports: [ DLTRowComponent]
})

export class PluginModule {

    private _api: string | undefined;

    public setAPI(api: any) {
        this._api = api;
    }

}
