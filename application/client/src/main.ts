import '@loader/init';
import '@loader/system';

import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';
import { system } from '@platform/modules/system';

if (environment.production) {
    enableProdMode();
}

system.init().then(() => {
    platformBrowserDynamic()
        .bootstrapModule(AppModule)
        .catch((err) => console.error(err));
    // system.destroy().then(() => {
    //     platformBrowserDynamic()
    //         .bootstrapModule(AppModule)
    //         .catch((err) => console.error(err));
    // });
});
