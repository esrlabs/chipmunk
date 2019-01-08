import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';
/*
declare const SystemJS;
import * as angularCore from '@angular/core';
import * as angularCommon from '@angular/common';
SystemJS.set('@angular/core', SystemJS.newModule(angularCore));
SystemJS.set('@angular/common', SystemJS.newModule(angularCommon));
*/
/*
import { System } from 'systemjs';

import * as angularCore from '@angular/core';
import * as angularCommon from '@angular/common';
import * as angularCommonHttp from '@angular/common/http';

System.set('@angular/core', System.newModule(angularCore));
System.set('@angular/common', System.newModule(angularCommon));
System.set('@angular/common/http', System.newModule(angularCommonHttp));
*/
if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
