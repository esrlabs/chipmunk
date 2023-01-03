import '@loader/init';
import '@loader/system';

import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';
import { system } from '@platform/modules/system';

import * as wasm from '@loader/wasm';

if (environment.production) {
    enableProdMode();
}

class Application {
    public run(): void {
        wasm.load()
            .then(() => {
                system
                    .init()
                    .then(() => {
                        platformBrowserDynamic()
                            .bootstrapModule(AppModule)
                            .catch((err: Error) => {
                                console.error(`Fail to bootstrap modules: ${err.message}`);
                            });
                    })
                    .catch((err: Error) => {
                        console.error(`Fail to load system module: ${err.message}`);
                    });
            })
            .catch((err: Error) => {
                console.error(`Fail to load wasm modules: ${err.message}`);
            });
    }
}

const application = new Application();
application.run();
