import { AfterViewInit, Component, Compiler, Injector, ViewChild, ViewContainerRef } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less']
})

export class AppComponent implements AfterViewInit {
  title = 'using-plugin';
  @ViewChild('content', { read: ViewContainerRef }) content: ViewContainerRef;

  constructor(private _compiler: Compiler, private _injector: Injector) { }

  ngAfterViewInit() {
    this.loadPlugins();
  }
  private loadPlugins() {
    // import external module bundle
    return new Promise((resolve, reject) => {
      import('plugin-c').then((module) => {
        module.doSomething();
        // compile module
        this._compiler.compileModuleAsync<any>(module.PluginCModule).then((moduleFactory) => {
          // resolve component factory
          const moduleRef = moduleFactory.create(this._injector);
        
          // get the custom made provider name 'plugins' 
          const componentProvider = moduleRef.injector.get('plugins');

          // from plugins array load the component on position 0 
          const componentFactory = moduleRef.componentFactoryResolver
                                            .resolveComponentFactory<any>(
                                                componentProvider[0][0].component
                                            );

          // compile component 
          const pluginComponent = this.content.createComponent(componentFactory);

          //sending @Input() values 
          //pluginComponent.instance.anyInput = "inputValue"; 

          //accessing the component template view
          //(pluginComponent.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
        });
      });
    });
  }
}
