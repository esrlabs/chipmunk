import { AfterViewInit, Component, Compiler, Injector, ViewChild, ViewContainerRef } from '@angular/core';
import { NotificationsService } from './environment/services/service.notifications';

import * as AngularCore from '@angular/core';
import * as AngularCommon from '@angular/common';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less']
})

export class AppComponent implements AfterViewInit {
  title = 'logviewer';
  @ViewChild('content', { read: ViewContainerRef }) content: ViewContainerRef;

  constructor(
    private _compiler: Compiler,
    private _injector: Injector,
    private _notifications: NotificationsService) { }

  ngAfterViewInit() {
    return;
    const path = 'assets/plugin-c.umd.js';

    fetch(path).then((res: Response) => {
      res.text().then((source: string) => {
        console.log(source);
        const exports: any = {}; // this will hold module exports
        const modules: any = {   // this is the list of modules accessible by plugin
          '@angular/core': AngularCore,
          '@angular/common': AngularCommon
        };

        const require = (module) => modules[module]; // shim 'require'
        eval(source);
        exports.doSomething();
        this._compiler.compileModuleAndAllComponentsAsync<any>(exports['PluginCModule']).then((mwcf) => {
          const componentFactory = mwcf.componentFactories.find(e => e.selector === 'lib-plugin-c'); // find the entry component
          if (componentFactory) {
            const componentRef = this.content.createComponent(componentFactory);
            // componentRef.instance.data = 'Some Data';
          }
        });

        console.log(source);
      });
    });
    // this.loadPlugins();
  }


}
