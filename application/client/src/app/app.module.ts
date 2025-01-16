import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { LayoutModule } from '@layout/module';
import { ViewsModule } from '@views/module';
import { ElementsModule } from '@elements/module';
import { TabsModule } from '@ui/tabs/module';

import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_BOTTOM_SHEET_DEFAULT_OPTIONS } from '@angular/material/bottom-sheet';

@NgModule({
    declarations: [AppComponent],
    imports: [
        BrowserModule,
        ElementsModule,
        TabsModule,
        LayoutModule,
        ViewsModule,
        BrowserAnimationsModule,
    ],
    providers: [{ provide: MAT_BOTTOM_SHEET_DEFAULT_OPTIONS, useValue: { hasBackdrop: false } }],
    bootstrap: [AppComponent],
})
export class AppModule {}
