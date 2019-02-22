import { BrowserModule } from '@angular/platform-browser';
import { COMPILER_OPTIONS, CompilerFactory, Compiler, NgModule } from '@angular/core';
import { JitCompilerFactory } from '@angular/platform-browser-dynamic';

import { AppComponent } from './app.component';

import { EnvironmentModule } from './environment/module';

export function createCompiler(fn: CompilerFactory): Compiler {
  return fn.createCompiler();
}

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    EnvironmentModule
  ],
  providers: [{
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
  }],
  bootstrap: [AppComponent]
})
export class AppModule { }
