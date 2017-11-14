/*
* @Author of the base (according which was developed this module) is: http://blog.rangle.io/dynamically-creating-components-with-angular-2/ (http://plnkr.co/edit/ZXsIWykqKZi5r75VMtw2?p=preview)
* */

import { Component, Input, ViewContainerRef, ViewChild, ReflectiveInjector, ComponentFactoryResolver} from '@angular/core';

import { viewsControllersListArr    } from './controllers.list';

@Component({
    selector        : 'dynamic-component',
    entryComponents : [viewsControllersListArr],
    template        : '<span #viewComponentController></span>',
})

export class DynamicComponent {

    currentComponent : any = null;

    @ViewChild('viewComponentController', { read: ViewContainerRef }) viewComponentController: ViewContainerRef;

    // component: Class for the component you want to create
    // inputs: An object with key/value pairs mapped to input name/input value
    @Input() set viewController(data: {component: any, inputs: any, params : Object }) {
        if (!data) {
            return;
        }

        // Inputs need to be in the following format to be resolved properly
        let inputProviders = Object.keys(data.inputs).map((inputName) => {return {provide: inputName, useValue: data.inputs[inputName]};});
        let resolvedInputs = ReflectiveInjector.resolve(inputProviders);

        // We create an injector out of the data we want to pass down and this components injector
        let injector = ReflectiveInjector.fromResolvedProviders(resolvedInputs, this.viewComponentController.parentInjector);

        // We create a factory out of the component we want to create
        let factory = this.resolver.resolveComponentFactory(data.component);

        // We create the component using the factory and the injector
        let component = factory.create(injector);

        //Setups params
        Object.keys(data.params).forEach((param)=>{
            component.instance[param] !== void 0 && (component.instance[param] = data.params[param]);
        });

        // We insert the component into the dom container
        this.viewComponentController.insert(component.hostView);

        // We can destroy the old component is we like by calling destroy
        if (this.currentComponent) {
            this.currentComponent.destroy();
        }

        this.currentComponent = component;
    }

    constructor(private resolver: ComponentFactoryResolver) {

    }
}