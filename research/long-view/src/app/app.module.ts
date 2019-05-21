import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { ComplexInfinityOutputModule } from './long/module';
import { AppComponent } from './app.component';
import { RowComponent } from './row/component';
@NgModule({
  entryComponents : [ RowComponent ],
  declarations: [
    AppComponent, RowComponent
  ],
  imports: [
    BrowserModule,
    ComplexInfinityOutputModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
