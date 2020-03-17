import { BrowserModule                          } from '@angular/platform-browser';
import { JitCompilerFactory                     } from '@angular/platform-browser-dynamic';
import { AppComponent                           } from './app.component';
import { EnvironmentModule                      } from './environment/module';
import { BrowserAnimationsModule                } from '@angular/platform-browser/animations';
import { MatNativeDateModule                    } from '@angular/material/core';
import {
    FormsModule,
    ReactiveFormsModule } from '@angular/forms';
import {
    COMPILER_OPTIONS,
    CompilerFactory,
    Compiler,
    NgModule } from '@angular/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSliderModule } from '@angular/material/slider';

export function createCompiler(fn: CompilerFactory): Compiler {
    return fn.createCompiler();
}

@NgModule({
    declarations: [
        AppComponent,
    ],
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
    ],
    providers: [
        {
            provide: COMPILER_OPTIONS,
            useValue: {},
            multi: true
        },
        {
            provide: CompilerFactory,
            useClass: JitCompilerFactory,
            deps: [COMPILER_OPTIONS]
        },
        {
            provide: Compiler,
            useFactory: createCompiler,
            deps: [CompilerFactory]
        }
    ],
    bootstrap: [AppComponent]
})

export class AppModule { }
