import { DecoratorConstructor } from '@platform/env/decorators';
import { getPropByPath } from '@platform/env/obj';

export function getComponentSelector(constructor: DecoratorConstructor): string | undefined {
    const PATH = 'ɵcmp.selectors';
    const selectors = getPropByPath<unknown, string[][]>(constructor, PATH);
    if (
        !(selectors instanceof Array) ||
        selectors.length === 0 ||
        !(selectors[0] instanceof Array) ||
        selectors[0].length === 0 ||
        typeof selectors[0][0] !== 'string'
    ) {
        return undefined;
    }
    return selectors[0][0];
}
