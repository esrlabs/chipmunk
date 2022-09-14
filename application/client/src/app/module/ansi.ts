import { convert } from '@ansi/ansi';
import { error } from '@platform/env/logger';

export function ansiToHtml(input: string): string | Error {
    try {
        return convert(input);
    } catch (e) {
        return new Error(error(e));
    }
}
