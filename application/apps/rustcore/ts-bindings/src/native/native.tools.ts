import { getNativeModule } from './native';
import { error } from '../util/logging';

export function execute(filename: string, args: string[]): Promise<void> {
    const ModRef = getNativeModule();
    return new Promise((resolve, reject) => {
        ModRef.execute(filename, args)
            .then(resolve)
            .catch((err: unknown) => {
                reject(new Error(error(err)));
            });
    });
}
