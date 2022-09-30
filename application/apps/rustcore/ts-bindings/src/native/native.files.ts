import { getNativeModule } from './native';
import { error } from '../util/logging';

export function checksum(filename: string): Promise<string> {
    const FilesRef = getNativeModule().Files;
    const files = new FilesRef();
    return files
        .checksum(filename)
        .then((hash: string) => {
            return hash;
        })
        .catch((err: unknown) => {
            return Promise.reject(new Error(error(err)));
        });
}
