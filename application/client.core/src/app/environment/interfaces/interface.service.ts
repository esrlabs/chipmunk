export interface IService {
    init: () => Promise<void>;
    getName: () => string;
}
