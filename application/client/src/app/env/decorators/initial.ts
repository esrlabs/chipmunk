import { singleDecoratorFactory, DecoratorConstructor } from '@platform/env/decorators';
import { getComponentSelector } from '@env/reflect';
import { scope } from '@platform/env/scope';

export class Components {
    private _components: Map<string, DecoratorConstructor> = new Map();

    public add(selector: string, constructor: DecoratorConstructor) {
        this._components.set(selector, constructor);
    }

    public get(selector: string): DecoratorConstructor {
        const target = this._components.get(selector);
        if (target === undefined) {
            throw new Error(`Fail to find initial component "${selector}"`);
        }
        return target;
    }
}

const components = new Components();

function getSelector(constructor: DecoratorConstructor): string {
    const selector: string | undefined = getComponentSelector(constructor);
    if (selector === undefined) {
        console.log(constructor);
        throw new Error(`Fail to detect selector for angular component`);
    }
    return selector;
}
export const Initial = singleDecoratorFactory((constructor: DecoratorConstructor) => {
    const selector: string = getSelector(constructor);
    components.add(selector, constructor);
    scope.getLogger('@Initial').debug(`${selector} has been registered as initial`);
    return class extends constructor {};
});

export { components };
