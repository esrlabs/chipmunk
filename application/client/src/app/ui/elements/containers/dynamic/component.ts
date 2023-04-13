/*
src: http://blog.rangle.io/dynamically-creating-components-with-angular-2/
*/

import { Component, Input, ViewContainerRef } from '@angular/core';
import { setProp } from '@platform/env/obj';

export interface IComponentDesc {
    factory: any;
    inputs?: any;
}

const CCacheFactoryKey: string = '__dynamic_component_factory_cache_key__';
const getSequence: () => number = (function () {
    let sequence: number = 0;
    return () => {
        return sequence++;
    };
})();

@Component({
    selector: 'lib-containers-dynamic',
    template: '',
    styles: [':host { display: none; }']
})
export class DynamicComponent {
    private _component: any = null;
    private _cachedKey: number = -1;

    @Input() detectChanges = true;
    @Input() alwaysDrop = false;

    @Input() set component(desc: IComponentDesc) {
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
                this.viewContainerRef.remove();
                this._component = undefined;
            }
        }
        if (typeof desc !== 'object' || desc === null || desc === undefined) {
            return;
        }
        if (desc.factory === undefined) {
            return;
        }
        if (desc.inputs === undefined) {
            desc.inputs = {};
        }
        const component = this.viewContainerRef.createComponent(desc.factory);
        Object.keys(desc.inputs).forEach((inputName) => {
            setProp(component.instance, inputName, desc.inputs[inputName]);
        });
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

    constructor(private viewContainerRef: ViewContainerRef) {}
}
