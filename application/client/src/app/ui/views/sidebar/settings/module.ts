import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Settings } from './component';

const entryComponents = [Settings];
const components = [...entryComponents];

@NgModule({
    imports: [
        CommonModule
    ],
    declarations: [...components],
    exports: [...components]
})
export class SettingsModule {}
