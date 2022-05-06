export interface DecoratorConstructor extends Function {
    new (...args: any[]): any;
}

export type DecoratorInjector<Input> = (
    cls: DecoratorConstructor,
    obj: Input,
) => DecoratorConstructor & any;

/**
 * Note! Properties will not be available in constructor
 */
export function decoratorFactory<Input>(injector: DecoratorInjector<Input>) {
    return function decorator<T extends { new (...args: any[]): any }>(obj: Input): any {
        return (constructor: T): T & any => {
            return injector(constructor, obj);
        };
    };
}

export type SingleDecoratorInjector = (cls: DecoratorConstructor) => DecoratorConstructor & any;

/**
 * Note! Properties will not be available in constructor
 */
export function singleDecoratorFactory(injector: SingleDecoratorInjector) {
    return function decorator<T extends { new (...args: any[]): any }>(): any {
        return (constructor: T): T & any => {
            return injector(constructor);
        };
    };
}

export type MethodDecoratorInjector = (
    cls: DecoratorConstructor,
    propertyKey: string,
    descriptor: PropertyDescriptor,
) => DecoratorConstructor & any;

export function methodDecoratorFactory(injector: MethodDecoratorInjector) {
    return function decorator<T extends { new (...args: any[]): any }>(): any {
        return (constructor: T, propertyKey: string, descriptor: PropertyDescriptor): T & any => {
            return injector(constructor, propertyKey, descriptor);
        };
    };
}
