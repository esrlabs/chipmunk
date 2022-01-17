/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from './buffer';

export const UTF8WithBom = 'utf8bom';
export const UTF16be = 'utf16be';
export const UTF16le = 'utf16le';

export const UTF16beBOM = [0xfe, 0xff];
export const UTF16leBOM = [0xff, 0xfe];
export const UTF8_BOM = [0xef, 0xbb, 0xbf];

const ZERO_BYTE_DETECTION_BUFFER_MAX_LEN = 512; // number of bytes to look at to decide about a file being binary or not

export function detectEncodingByBOMFromBuffer(
    buffer: VSBuffer | null,
    bytesRead: number,
): typeof UTF8WithBom | typeof UTF16le | typeof UTF16be | null {
    if (!buffer || bytesRead < UTF16beBOM.length) {
        return null;
    }

    const b0 = buffer.readUInt8(0);
    const b1 = buffer.readUInt8(1);

    // UTF-16 BE
    if (b0 === UTF16beBOM[0] && b1 === UTF16beBOM[1]) {
        return UTF16be;
    }

    // UTF-16 LE
    if (b0 === UTF16leBOM[0] && b1 === UTF16leBOM[1]) {
        return UTF16le;
    }

    if (bytesRead < UTF8_BOM.length) {
        return null;
    }

    const b2 = buffer.readUInt8(2);

    // UTF-8
    if (b0 === UTF8_BOM[0] && b1 === UTF8_BOM[1] && b2 === UTF8_BOM[2]) {
        return UTF8WithBom;
    }

    return null;
}

export interface IDetectedEncodingResult {
    encoding: string | null;
    seemsBinary: boolean;
}

export interface IReadResult {
    buffer: VSBuffer | null;
    bytesRead: number;
}

export function detectEncodingFromBuffer(
    readResult: IReadResult,
    autoGuessEncoding?: false,
): IDetectedEncodingResult;
export function detectEncodingFromBuffer(
    readResult: IReadResult,
    autoGuessEncoding?: boolean,
): Promise<IDetectedEncodingResult>;
export function detectEncodingFromBuffer({
    buffer,
    bytesRead,
}: IReadResult): Promise<IDetectedEncodingResult> | IDetectedEncodingResult {
    // Always first check for BOM to find out about encoding
    let encoding = detectEncodingByBOMFromBuffer(buffer, bytesRead);

    // Detect 0 bytes to see if file is binary or UTF-16 LE/BE
    // unless we already know that this file has a UTF-16 encoding
    let seemsBinary = false;
    if (encoding !== UTF16be && encoding !== UTF16le && buffer) {
        let couldBeUTF16LE = true; // e.g. 0xAA 0x00
        let couldBeUTF16BE = true; // e.g. 0x00 0xAA
        let containsZeroByte = false;

        // This is a simplified guess to detect UTF-16 BE or LE by just checking if
        // the first 512 bytes have the 0-byte at a specific location. For UTF-16 LE
        // this would be the odd byte index and for UTF-16 BE the even one.
        // Note: this can produce false positives (a binary file that uses a 2-byte
        // encoding of the same format as UTF-16) and false negatives (a UTF-16 file
        // that is using 4 bytes to encode a character).
        for (let i = 0; i < bytesRead && i < ZERO_BYTE_DETECTION_BUFFER_MAX_LEN; i++) {
            const isEndian = i % 2 === 1; // assume 2-byte sequences typical for UTF-16
            const isZeroByte = buffer.readUInt8(i) === 0;

            if (isZeroByte) {
                containsZeroByte = true;
            }

            // UTF-16 LE: expect e.g. 0xAA 0x00
            if (couldBeUTF16LE && ((isEndian && !isZeroByte) || (!isEndian && isZeroByte))) {
                couldBeUTF16LE = false;
            }

            // UTF-16 BE: expect e.g. 0x00 0xAA
            if (couldBeUTF16BE && ((isEndian && isZeroByte) || (!isEndian && !isZeroByte))) {
                couldBeUTF16BE = false;
            }

            // Return if this is neither UTF16-LE nor UTF16-BE and thus treat as binary
            if (isZeroByte && !couldBeUTF16LE && !couldBeUTF16BE) {
                break;
            }
        }

        // Handle case of 0-byte included
        if (containsZeroByte) {
            if (couldBeUTF16LE) {
                encoding = UTF16le;
            } else if (couldBeUTF16BE) {
                encoding = UTF16be;
            } else {
                seemsBinary = true;
            }
        }
    }
    return { seemsBinary, encoding };
}
