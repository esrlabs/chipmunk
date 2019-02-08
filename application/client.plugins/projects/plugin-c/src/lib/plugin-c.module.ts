import { NgModule } from '@angular/core';
import { PluginCComponent } from './plugin-c.component';
import { PluginCNestedModule } from './nested/module';

export function doSomething() {
  console.log('DONE!!!');
}

@NgModule({
  declarations: [PluginCComponent],
  entryComponents: [PluginCComponent],
  imports: [
    PluginCNestedModule
  ],
  exports: [PluginCComponent],
  providers: [{
    provide: 'plugins',
    useValue: [{
      name: 'plugin-c-component',
      component: PluginCComponent
    }],
    multi: true
  }]
})

export class PluginCModule { }
