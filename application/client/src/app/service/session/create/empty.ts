import { Session } from '../session';
import { Instance as Logger } from '@platform/env/logger';

export function proceed(): Promise<Session> {
    return new Promise((resolve, reject) => {
        const session = new Session();
        session
            .init({})
            .then((_uuid: string) => {
                resolve(session);
            })
            .catch(reject);
    });
}
