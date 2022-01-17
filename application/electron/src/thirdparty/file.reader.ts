/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from './buffer';
import * as fs from 'fs';

export interface ReadResult {
    buffer: VSBuffer | null;
    bytesRead: number;
}

export function readExactlyByFile(file: string, totalBytes: number): Promise<ReadResult> {
    return new Promise<ReadResult>((resolve, reject) => {
        fs.open(file, 'r', null, (err, fd) => {
            if (err) {
                return reject(err);
            }

            function end(
                endErr: Error | null,
                resultBuffer: Buffer | null,
                bytesRead: number,
            ): void {
                fs.close(fd, (closeError) => {
                    if (closeError) {
                        return reject(closeError);
                    }

                    if (endErr && (endErr as any).code === 'EISDIR') {
                        return reject(endErr); // we want to bubble this error up (file is actually a folder)
                    }

                    return resolve({
                        buffer: resultBuffer ? VSBuffer.wrap(resultBuffer) : null,
                        bytesRead,
                    });
                });
            }

            const buffer = Buffer.allocUnsafe(totalBytes);
            let offset = 0;

            function readChunk(): void {
                fs.read(fd, buffer, offset, totalBytes - offset, null, (readErr, bytesRead) => {
                    if (readErr) {
                        return end(readErr, null, 0);
                    }

                    if (bytesRead === 0) {
                        return end(null, buffer, offset);
                    }

                    offset += bytesRead;

                    if (offset === totalBytes) {
                        return end(null, buffer, offset);
                    }

                    return readChunk();
                });
            }

            readChunk();
        });
    });
}
