import { File, Stat, FileType } from '@platform/types/files';

import * as obj from '@platform/env/obj';
import * as fs from 'fs';
import * as path from 'path';

export function getFileEntity(filename: string): File | Error {
    try {
        const stat = fs.statSync(filename);
        return {
            filename,
            ext: path.extname(filename),
            path: path.dirname(filename),
            name: path.basename(filename),
            stat: obj.from<Stat>(stat, [
                'dev',
                'ino',
                'mode',
                'nlink',
                'uid',
                'gid',
                'rdev',
                'size',
                'blksize',
                'blocks',
                'atimeMs',
                'mtimeMs',
                'ctimeMs',
                'birthtimeMs',
            ]),
            type: detectSupportedFileType(filename),
        };
    } catch (_) {
        return new Error(`Fail to get stat info for "${filename}"`);
    }
}

export function detectSupportedFileType(filename: string): FileType {
    switch (path.extname(filename).toLowerCase()) {
        case '.dlt':
            return FileType.Dlt;
        case '.pcap':
        case '.pcapng':
            return FileType.Pcap;
        default:
            return FileType.Text;
    }
}
