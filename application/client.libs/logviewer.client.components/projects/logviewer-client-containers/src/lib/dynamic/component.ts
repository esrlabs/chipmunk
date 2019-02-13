/*
src: http://blog.rangle.io/dynamically-creating-components-with-angular-2/
*/

import { Component, Input, ViewContainerRef, ReflectiveInjector, ComponentFactoryResolver } from '@angular/core';

export interface IComponentDesc {
    factory: any;
    resolved?: boolean;
    inputs?: any;
}

@Component({
    selector        : 'lib-containers-dynamic',
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
        let component;
        if (!desc.resolved) {
            // Factory of component isn't resolved
            const inputProviders = Object.keys(desc.inputs).map((inputName) => {
                return {
                    provide: inputName,
                    useValue: desc.inputs[inputName],
                };
            });
            const resolvedInputs = ReflectiveInjector.resolve(inputProviders);
            const injector = ReflectiveInjector.fromResolvedProviders(resolvedInputs, this.viewContainerRef.injector);
            const factory = this.resolver.resolveComponentFactory(desc.factory);
            component = factory.create(injector);
            Object.keys(desc.inputs).forEach((key: string) => {
                component.instance[key] = desc.inputs[key];
            });
            this.viewContainerRef.insert(component.hostView);
            if (this.detectChanges === true)  {
                component.hostView.detectChanges();
            }
        } else {
            // Factory of component is already resolved
            component = this.viewContainerRef.createComponent(desc.factory);
            Object.keys(desc.inputs).forEach((inputName) => {
                component.instance[inputName] = desc.inputs[inputName];
            });
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
