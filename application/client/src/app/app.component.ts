import { AfterViewInit, Component, Compiler, Injector, ViewChild, ViewContainerRef } from '@angular/core';
import { NotificationsService } from './environment/services/service.notifications';
import { TabsService } from './environment/services/service.tabs';
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
    private _notifications: NotificationsService,
    private _tabs: TabsService) { }

  ngAfterViewInit() {
    this._notifications.add({
      caption: 'test',
      message: 'this is test notification this is test notification this is test notification'
    });
    setTimeout(() => {
      this._notifications.add({
        caption: 'test',
        message: 'this is test notification this is test notification this is test notification',
        buttons: [
          { caption: 'yes', handler: () => {}},
          { caption: 'cancel', handler: () => {}},
        ]
      });
    }, 3000);

    this._tabs.add({
      name: 'Tab 1 (3)',
      active: true,
      docks: [
          { caption: 'text 1'},
          { caption: 'text 2'},
          { caption: 'text 3'},
      ],
    });
    this._tabs.add({
      name: 'Tab 2 (2)',
      active: false,
      docks: [
          { caption: 'text 1'},
          { caption: 'text 2'}
      ],
    });
    this._tabs.add({
      name: 'Tab 3 (4)',
      active: false,
      docks: [
        { caption: 'text 1'},
        { caption: 'text 2'},
        { caption: 'text 3'},
        { caption: 'text 4'},
      ],
    });
    this._tabs.add({
      name: 'Tab 4 (5)',
      active: false,
      docks: [
        { caption: 'text 1'},
        { caption: 'text 2'},
        { caption: 'text 3'},
        { caption: 'text 4'},
        { caption: 'text 5'},
      ],
    });
    this._tabs.add({
      name: 'Tab 5 (1)',
      active: false,
      docks: [
          { caption: 'text 1'},
      ],
    });
    return;
    const path = 'assets/plugin-c.umd.js';

    fetch(path).then((res: Response) => {
      res.text().then((source: string) => {
        console.log(source);
        const exports = {}; // this will hold module exports
        const modules = {   // this is the list of modules accessible by plugin
          '@angular/core': AngularCore,
          '@angular/common': AngularCommon
        };

        const require = (module) => modules[module]; // shim 'require'
        eval(source);
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
