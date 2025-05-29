import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NestedDictionaryModule } from './nested_dictionary/module';
import { FilesSelectorModule } from './files_selector/module';
import { TimezoneSelectorModule } from './timezone/module';

@NgModule({
    imports: [
        CommonModule,
        NestedDictionaryModule,
        FilesSelectorModule,
        TimezoneSelectorModule,
    ],
    exports: [
        NestedDictionaryModule,
        FilesSelectorModule,
        TimezoneSelectorModule,
    ],
})
export class ComplexFieldsModule {}
