export interface IService {
    init: () => Promise<void>;
    destroy: () => Promise<void>;
    getName: () => string;
}
