/*
src: http://blog.rangle.io/dynamically-creating-components-with-angular-2/
*/

import { Component, Input, ViewContainerRef, ComponentFactoryResolver, Injector, InjectionToken } from '@angular/core';

export interface IComponentDesc {
    factory: any;
    resolved?: boolean;
    inputs?: any;
}

const CCachedFactories: Map<number, any> = new Map();
const CCacheFactoryKey: string = '__dynamic_component_factory_cache_key__';
const getSequence: () => number = function() {
    let sequence: number = 0;
    return () => {
        return sequence ++;
    };
}();

@Component({
    selector        : 'lib-containers-dynamic',
    entryComponents : [],
    template        : '',
    styles          : [':host { display: none; }'],
})

export class DynamicComponent {

    private _component: any = null;
    private _cachedKey: number = -1;

    @Input() detectChanges = true;
    @Input() alwaysDrop = false;

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
        if (this._component) {
            const cacheKey: number | undefined = this._getKey(desc.factory);
            // Component already was created
            if (!this.alwaysDrop && this._cachedKey === cacheKey) {
                // No need to recreate component. Update inputs
                Object.keys(desc.inputs).forEach((key: string) => {
                    this._component.instance[key] = desc.inputs[key];
                });
                this._component.hostView.detectChanges();
                return;
            } else {
                this._component.destroy();
            }
        }
        let component;
        if (!desc.resolved) {
            // Factory of component isn't resolved
            const cacheKey: number | undefined = this._getKey(desc.factory);
            let factory = cacheKey === undefined ? undefined : CCachedFactories.get(cacheKey);
            if (factory === undefined) {
                const inputProviders = Object.keys(desc.inputs).map((inputName) => {
                    const token = new InjectionToken<any>(inputName);
                    return { provide: token, useValue: desc.inputs[inputName] };
                });
                const injector = Injector.create({
                    providers: inputProviders,
                    parent: this.viewContainerRef.injector,
                });
                factory = this.resolver.resolveComponentFactory(desc.factory);
                component = factory.create(injector);
                CCachedFactories.set(cacheKey, { factory: factory, injector: injector });
            } else {
                component = factory.factory.create(factory.injector);
            }
            this._cachedKey = cacheKey;
            Object.keys(desc.inputs).forEach((key: string) => {
                component.instance[key] = desc.inputs[key];
            });
            this.viewContainerRef.insert(component.hostView);
            if (this.detectChanges)  {
                component.hostView.detectChanges();
            }
        } else {
            // Factory of component is already resolved
            component = this.viewContainerRef.createComponent(desc.factory);
            Object.keys(desc.inputs).forEach((inputName) => {
                component.instance[inputName] = desc.inputs[inputName];
            });
        }
        this._component = component;
    }

    private _getKey(factory: any): number | undefined {
        if ((typeof factory !== 'object' || factory === null) && typeof factory !== 'function') {
            return undefined;
        }
        if (typeof factory[CCacheFactoryKey] === 'number') {
            return factory[CCacheFactoryKey];
        }
        factory[CCacheFactoryKey] = getSequence();
        return undefined;
    }

    constructor(
        private resolver: ComponentFactoryResolver,
        private viewContainerRef: ViewContainerRef) {
    }

}
