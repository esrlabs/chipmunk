/*
src: http://blog.rangle.io/dynamically-creating-components-with-angular-2/
*/

import { Component, Input, ViewContainerRef, ReflectiveInjector, ComponentFactoryResolver } from '@angular/core';

export interface IComponentDesc {
    factory: any;
    inputs?: any;
}

@Component({
    selector        : 'app-dynamic-com',
    entryComponents : [],
    template        : '',
})

export class DynamicComponent {

    private _component: any = null;

    @Input() detectChanges = true;

    @Input() set component(desc: IComponentDesc) {
        if (typeof desc !== 'object' || desc === null) {
            return;
        }
        if (desc.factory === void 0) {
            return;
        }
        if (desc.inputs === void 0) {
            desc.inputs = {};
        }
        const inputProviders = Object.keys(desc.inputs).map((inputName) => {
            return {
                provide: inputName,
                useValue: desc.inputs[inputName],
            };
        });
        const resolvedInputs = ReflectiveInjector.resolve(inputProviders);
        const injector = ReflectiveInjector.fromResolvedProviders(resolvedInputs, this.viewContainerRef.injector);
        const factory = this.resolver.resolveComponentFactory(desc.factory);
        const component = factory.create(injector);
        Object.keys(desc.inputs).forEach((key: string) => {
            component.instance[key] = desc.inputs[key];
        });
        this.viewContainerRef.insert(component.hostView);
        if (this.detectChanges === true)  {
            component.hostView.detectChanges();
        }
        if (this._component) {
            this._component.destroy();
        }
        this._component = component;
    }

    constructor(
        private resolver: ComponentFactoryResolver,
        private viewContainerRef: ViewContainerRef) {
    }

}
