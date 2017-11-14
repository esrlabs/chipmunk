import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';

import { loader } from './app/core/core.load';

import {enableProdMode} from '@angular/core';

enableProdMode();

loader.init(()=>{
    platformBrowserDynamic().bootstrapModule(AppModule).then((ref)=>{ });
});
