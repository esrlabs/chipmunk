/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare const Buffer: any;

const hasBuffer = typeof Buffer !== 'undefined';

export class VSBuffer {
    readonly buffer: Uint8Array;
    readonly byteLength: number;

    private constructor(buffer: Uint8Array) {
        this.buffer = buffer;
        this.byteLength = this.buffer.byteLength;
    }

    /**
     * When running in a nodejs context, the backing store for the returned `VSBuffer` instance
     * might use a nodejs Buffer allocated from node's Buffer pool, which is not transferrable.
     */
    static alloc(byteLength: number): VSBuffer {
        if (hasBuffer) {
            return new VSBuffer(Buffer.allocUnsafe(byteLength));
        } else {
            return new VSBuffer(new Uint8Array(byteLength));
        }
    }

    /**
     * When running in a nodejs context, if `actual` is not a nodejs Buffer, the backing store for
     * the returned `VSBuffer` instance might use a nodejs Buffer allocated from node's Buffer pool,
     * which is not transferrable.
     */
    static wrap(actual: Uint8Array): VSBuffer {
        if (hasBuffer && !Buffer.isBuffer(actual)) {
            // https://nodejs.org/dist/latest-v10.x/docs/api/buffer.html#buffer_class_method_buffer_from_arraybuffer_byteoffset_length
            // Create a zero-copy Buffer wrapper around the ArrayBuffer pointed to by the Uint8Array
            actual = Buffer.from(actual.buffer, actual.byteOffset, actual.byteLength);
        }
        return new VSBuffer(actual);
    }

    readUInt8(offset: number): number {
        return readUInt8(this.buffer, offset);
    }
}

export function readUInt8(source: Uint8Array, offset: number): number {
    return source[offset];
}
