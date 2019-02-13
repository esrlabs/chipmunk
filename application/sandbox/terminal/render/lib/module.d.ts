import { ViewComponent } from './view/component';
export declare class PluginModule {
    getView(): typeof ViewComponent;
    getStatusBarApp(): boolean;
    getStaticApp(): boolean;
}
