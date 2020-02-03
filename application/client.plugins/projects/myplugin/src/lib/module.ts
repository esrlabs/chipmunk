import { NgModule } from '@angular/core';
import { MypluginComponent } from './component';
import { PrimitiveModule } from 'chipmunk-client-primitive';
import * as Toolkit from 'chipmunk.client.toolkit';



@NgModule({
  declarations: [MypluginComponent],
  imports: [ PrimitiveModule ],
  exports: [MypluginComponent]
})

export class PluginModule extends Toolkit.PluginNgModule {

  constructor() {
      super('MyPlugin', 'Creates a template plugin');
  }

}
