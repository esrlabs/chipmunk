import { NgModule } from '@angular/core';
import { ViewComponent } from './view/component';

@NgModule({
    entryComponents: [ViewComponent],
    declarations: [ViewComponent],
    imports: [ ],
    exports: [ViewComponent]
})

export class PluginModule {

    public getView() {
        return ViewComponent;
    }

    public getStatusBarApp() {
        return true;
    }

    public getStaticApp() {
        return true;
    }
}
