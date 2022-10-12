export abstract class EntityUpdateEvent<T, E> {
    abstract consequence(): {
        // require redrawing of rows
        highlights: boolean;
        // require updating of data, like research
        value: boolean;
        // require redrawing of holders (like filter element)
        inner: boolean;
    };
    abstract inner(): T;
    abstract entity(): E;
}
