import { settings } from '@service/settings';

export class Validator<T extends string | number | boolean | undefined> {
    public validate(path: string, key: string, value: T): Promise<string | undefined> {
        return settings.validate(path, key, value);
    }
}
