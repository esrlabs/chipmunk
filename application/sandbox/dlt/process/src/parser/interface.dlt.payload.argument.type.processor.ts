export interface IPayloadTypeProcessor<T> {
    read(): T | Error,
    crop(): Buffer
}