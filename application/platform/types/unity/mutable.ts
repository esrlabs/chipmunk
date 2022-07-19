export type Mutable<Type> = {
    -readonly [Key in keyof Type]: Type[Key];
};
