import { BrowserModule } from '@angular/platform-browser';
import { JitCompilerFactory } from '@angular/platform-browser-dynamic';
import { AppComponent } from './app.component';
import { EnvironmentModule } from './environment/module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatNativeDateModule } from '@angular/material/core';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { COMPILER_OPTIONS, CompilerFactory, Compiler, NgModule, CompilerOptions } from '@angular/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSliderModule } from '@angular/material/slider';
import { MarkdownModule } from 'ngx-markdown';

const compilerOptions: CompilerOptions = {
    useJit: true,
};
  
export function createCompiler(compilerFactory: CompilerFactory) {
    return compilerFactory.createCompiler([compilerOptions]);
}

@NgModule({
    declarations: [AppComponent],
    imports: [
        BrowserModule,
        FormsModule,
        ReactiveFormsModule,
        MatNativeDateModule,
        MatSliderModule,
        EnvironmentModule,
        MatFormFieldModule,
        MatInputModule,
        MatAutocompleteModule,
        MatOptionModule,
        MatProgressBarModule,
        BrowserAnimationsModule,
        HttpClientModule,
        MarkdownModule.forRoot({ loader: HttpClient }),
    ],
    providers: [
        {
            provide: COMPILER_OPTIONS,
            useValue: {},
            multi: true,
        },
        {
            provide: CompilerFactory,
            useClass: JitCompilerFactory,
            deps: [COMPILER_OPTIONS],
        },
        {
            provide: Compiler,
            useFactory: createCompiler,
            deps: [CompilerFactory],
        },
    ],
    bootstrap: [AppComponent],
})
export class AppModule {}
