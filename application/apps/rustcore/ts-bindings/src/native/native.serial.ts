import { getNativeModule } from './native';
import { error } from '../util/logging';
import { Types } from '../interfaces/dlt';

export { Types };

export function ports(): Promise<string[]> {
    const SerialRef = getNativeModule().Serial;
    const serial = new SerialRef();
    return new Promise((resolve, reject) => {
        serial
            .ports()
            .then((ports: string[]) => {
                try {
                    resolve(ports);
                } catch (e) {
                    reject(new Error(error(e)));
                }
            })
            .catch((err: unknown) => {
                reject(new Error(error(err)));
            });
    });
}
