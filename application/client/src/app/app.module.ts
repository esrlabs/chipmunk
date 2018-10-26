import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';

import { plugins } from './plugins/register';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    ...plugins
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
