export abstract class EntityUpdateEvent<T, E> {
    abstract consequence(): {
        // require redrawing of rows
        highlights: boolean;
        // require updating of data, like research
        value: boolean;
        // require redrawing of holders (like filter element)
        inner: boolean;
        // require saving in remote store. For example number of matches doesn't require
        // saving operation
        storable: boolean;
    };
    abstract inner(): T;
    abstract entity(): E;
}
