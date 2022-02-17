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
        const stream: fs.ReadStream = fs.createReadStream(file, {
            start: 0,
            end: totalBytes <= 50 ? totalBytes : 50,
        });
        stream.on('data', (chunk: string | Buffer) => {
            resolve({
                buffer: VSBuffer.wrap(
                    typeof chunk === 'string' ? Buffer.from(chunk, 'utf-8') : chunk,
                ),
                bytesRead: Buffer.byteLength(chunk),
            });
        });
        stream.on('error', () => {
            reject("Failed to read file to detect if it's binary");
            stream.close();
        });
        stream.on('close', () => {
            stream.close();
        });
    });
}
