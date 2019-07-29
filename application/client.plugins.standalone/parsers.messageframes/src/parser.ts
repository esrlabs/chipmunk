// tslint:disable:object-literal-sort-keys
import * as Toolkit from 'logviewer.client.toolkit';

const sumUp = (x: any, y: any) => x + y;

function mapByteAtIndexToNumber(val: number, index: number, len: number): number {
    return val*(2**((len - 1 - index) * 8))
}

function fillHexString(str: string): string {
    return str.length == 1 ? "0" + str : str
}


interface OpcodeConstraints {
    readonly encrypted: boolean,
    readonly signed: boolean,
    readonly minPayloadLength: number,
    readonly maxPayloadLength: number,
}

enum OpcodeCsm4 {
    SessionData = 0x00,
    EncSessionData = 0x80,
    SignedSessionData = 0x40,
    SignedEncSessionData = 0xC0,
    BleChipInfo = 0x01,
    WakeupPattern = 0x02,
    SecureChannel_PartA_Request = 0x03,
    SecureChannel_PartA_Response = 0x04,
    SecureChannel_PartB_Request = 0x45,
    SecureChannel_PartB_Response = 0x06,
    ChallengeRequest = 0x07,
    Challenge = 0x08,
    ChallengeRejected = 0x09,
}

enum OpcodeV1 {
    AppProto = 0x00,
    EncAppProto = 0x80,
    SignedAppProto = 0x40,
    SignedEncAppProto = 0xC0,
    SecureChannel_PartA_Request = 0x03,
    SecureChannel_PartA_Response = 0x44,
    SecureChannel_PartB_Request = 0x45,
    SecureChannel_PartB_Response = 0x06,
    ChannelAuthorization = 0xC7,
    SignedAppProtoLTE = 0x50,
    SignedEncAppProtoLTE = 0xD0,
}

enum OpcodeV2 {
    AppProto = 0x00,
    EncAppProto = 0x80,
    SignedAppProto = 0x40,
    SignedEncAppProto = 0xC0,
    Order = 0x41,
    EncOrder = 0xC1,
    SecureChannel_PartA_Request = 0x03,
    SecureChannel_PartA_Response = 0x44,
    SecureChannel_PartB_Request = 0x45,
    SecureChannel_PartB_Response = 0x06,
    ChannelAuthorization = 0xC7,
    EncTimestamp = 0xD2,
}

const opcodeCsm4Lookup: { [index: number]: OpcodeConstraints } = {
    [OpcodeCsm4.SessionData]: {encrypted: false, signed: false, minPayloadLength: 0, maxPayloadLength: 0xFFFF},
    [OpcodeCsm4.EncSessionData]: {encrypted: true, signed: false, minPayloadLength: 0, maxPayloadLength: 0xFFFF},
    [OpcodeCsm4.SignedSessionData]: {encrypted: false, signed: true, minPayloadLength: 0, maxPayloadLength: 0xFFFF},
    [OpcodeCsm4.SignedEncSessionData]: {encrypted: true, signed: true, minPayloadLength: 0, maxPayloadLength: 0xFFFF},
    [OpcodeCsm4.BleChipInfo]: {encrypted: false, signed: false, minPayloadLength: 0, maxPayloadLength: 0xFFFF},
    [OpcodeCsm4.WakeupPattern]: {encrypted: false, signed: false, minPayloadLength: 4, maxPayloadLength: 4},
    [OpcodeCsm4.SecureChannel_PartA_Request]: {encrypted: false, signed: false, minPayloadLength: 0, maxPayloadLength: 0},
    [OpcodeCsm4.SecureChannel_PartA_Response]: {encrypted: false, signed: false, minPayloadLength: 64, maxPayloadLength: 64},
    [OpcodeCsm4.SecureChannel_PartB_Request]: {encrypted: false, signed: true, minPayloadLength: 4+64, maxPayloadLength: 4+64},
    [OpcodeCsm4.SecureChannel_PartB_Response]: {encrypted: false, signed: false, minPayloadLength: 0, maxPayloadLength: 0},
    [OpcodeCsm4.ChallengeRequest]: {encrypted: false, signed: false, minPayloadLength: 0, maxPayloadLength: 0},
    [OpcodeCsm4.Challenge]: {encrypted: false, signed: false, minPayloadLength: 0, maxPayloadLength: 0},
    [OpcodeCsm4.ChallengeRejected]: {encrypted: false, signed: false, minPayloadLength: 0, maxPayloadLength: 0},
}

const opcodeV1Lookup: { [index: number]: OpcodeConstraints } = {
    [OpcodeV1.AppProto]: {encrypted: false, signed: false, minPayloadLength: 0, maxPayloadLength: 0xFFF7},
    [OpcodeV1.EncAppProto]: {encrypted: true, signed: false, minPayloadLength: 0, maxPayloadLength: 0xFFF7},
    [OpcodeV1.SignedAppProto]: {encrypted: false, signed: true, minPayloadLength: 0, maxPayloadLength: 0xFFF7},
    [OpcodeV1.SignedEncAppProto]: {encrypted: true, signed: true, minPayloadLength: 0, maxPayloadLength: 0xFFF7},
    [OpcodeV1.SecureChannel_PartA_Request]: {encrypted: false, signed: false, minPayloadLength: 0, maxPayloadLength: 0},
    [OpcodeV1.SecureChannel_PartA_Response]: {encrypted: false, signed: true, minPayloadLength: 8+65, maxPayloadLength: 8+65},
    [OpcodeV1.SecureChannel_PartB_Request]: {encrypted: false, signed: true, minPayloadLength: 8+4+65, maxPayloadLength: 8+4+65},
    [OpcodeV1.SecureChannel_PartB_Response]: {encrypted: false, signed: false, minPayloadLength: 0, maxPayloadLength: 0xFFF7},
    [OpcodeV1.ChannelAuthorization]: {encrypted: true, signed: true, minPayloadLength: 2+1+64+2, maxPayloadLength: 0xFFF7},
    [OpcodeV1.SignedAppProtoLTE]: {encrypted: false, signed: true, minPayloadLength: 0, maxPayloadLength: 0xFFF7},
    [OpcodeV1.SignedEncAppProtoLTE]: {encrypted: true, signed: true, minPayloadLength: 0, maxPayloadLength: 0xFFF7},
}

const opcodeV2Lookup: { [index: number]: OpcodeConstraints } = {
    [OpcodeV2.AppProto]: {encrypted: false, signed: false, minPayloadLength: 0, maxPayloadLength: 0xFFFF},
    [OpcodeV2.EncAppProto]: {encrypted: true, signed: false, minPayloadLength: 0, maxPayloadLength: 0xFFFF},
    [OpcodeV2.SignedAppProto]: {encrypted: false, signed: true, minPayloadLength: 0, maxPayloadLength: 0xFFFF},
    [OpcodeV2.SignedEncAppProto]: {encrypted: true, signed: true, minPayloadLength: 0, maxPayloadLength: 0xFFFF},
    [OpcodeV2.Order]: {encrypted: false, signed: true, minPayloadLength: 0, maxPayloadLength: 0xFFFF},
    [OpcodeV2.EncOrder]: {encrypted: true, signed: true, minPayloadLength: 0, maxPayloadLength: 0xFFFF},
    [OpcodeV2.SecureChannel_PartA_Request]: {encrypted: false, signed: false, minPayloadLength: 0, maxPayloadLength: 0},
    [OpcodeV2.SecureChannel_PartA_Response]: {encrypted: false, signed: true, minPayloadLength: 8+65, maxPayloadLength: 8+65},
    [OpcodeV2.SecureChannel_PartB_Request]: {encrypted: false, signed: true, minPayloadLength: 8+4+65, maxPayloadLength: 8+4+65},
    [OpcodeV2.SecureChannel_PartB_Response]: {encrypted: false, signed: false, minPayloadLength: 0, maxPayloadLength: 0xFFFF},
    [OpcodeV2.ChannelAuthorization]: {encrypted: true, signed: true, minPayloadLength: 2+1+64+2, maxPayloadLength: 0xFFFF},
    [OpcodeV2.EncTimestamp]: {encrypted: true, signed: true, minPayloadLength: 16, maxPayloadLength: 16},
}

interface MessageFrameCsm4 {
    readonly encrypted: boolean;
    readonly signed: boolean;
    readonly opcode: number;
    readonly payloadLength: number;
    readonly payload: string;
    readonly challengeLength: number;
    readonly challenge: string;
    readonly signatureLength: number;
    readonly signature: string;
    valid: boolean;
    readonly leftoverBytes: number;
}

interface MessageFrameV0 {
    readonly version: number;
    readonly flags: number;
    readonly payloadLength: number;
    readonly payload: string;
    readonly signatureLength: number;
    readonly signature: string;
    readonly signatureKeyId: number;
    valid: boolean;
    readonly leftoverBytes: number;
}

interface MessageFrameV1 {
    readonly version: number;
    readonly encrypted: boolean;
    readonly signed: boolean;
    readonly opcode: number;
    readonly payloadLength: number;
    readonly payload: string;
    readonly signatureLength: number;
    readonly signature: string;
    readonly signatureKeyId: number;
    readonly timestamp: number;
    valid: boolean;
    readonly leftoverBytes: number;
}

interface MessageFrameV2 {
    readonly version: number;
    readonly encrypted: boolean;
    readonly signed: boolean;
    readonly opcode: number;
    readonly payloadLength: number;
    readonly payload: string;
    readonly signatureLength: number;
    readonly signature: string;
    valid: boolean;
    readonly leftoverBytes: number;
}

namespace MessageFrameCsm4 {
    export function decode(data: Array<number>): MessageFrameCsm4 | null {
        if (data.length < 1) { return null; }

        let headerByte: number | undefined = data.shift();
        if (headerByte == undefined) { return null; }

        let headerConstraints = opcodeCsm4Lookup[headerByte];
        if (!headerConstraints) { return null; }

        var payloadLength: number = 0;
        var challengeLength: number = 0;

        switch (headerByte) {
            case OpcodeCsm4.BleChipInfo:
            case OpcodeCsm4.SessionData:
            case OpcodeCsm4.EncSessionData:
            case OpcodeCsm4.SignedSessionData:
            case OpcodeCsm4.SignedEncSessionData:
                payloadLength = data.splice(0, 2)
                                    .map((val, index) => mapByteAtIndexToNumber(val, index, 2))
                                    .reduce(sumUp);
                break;
            case OpcodeCsm4.WakeupPattern:
                payloadLength = 4;
                break;
            case OpcodeCsm4.ChallengeRequest:
            case OpcodeCsm4.ChallengeRejected:
            case OpcodeCsm4.SecureChannel_PartA_Request:
            case OpcodeCsm4.SecureChannel_PartB_Response:
                // No Payload/Challenge/Signature
                break;
            case OpcodeCsm4.SecureChannel_PartA_Response: // Intentional Fallthrough
                payloadLength = 64;
            case OpcodeCsm4.Challenge:
                challengeLength = 8;
                break;
            case OpcodeCsm4.SecureChannel_PartB_Request:
                payloadLength = 68;
                break;
            default:
                return null;
        }

        if (data.length < payloadLength) { return null; }
        let payload: string = data.splice(0, payloadLength)
                                    .map(x => fillHexString(x.toString(16).toUpperCase()))
                                    .reduce(sumUp, "");

        challengeLength = headerConstraints.signed ? 8 : challengeLength;
        if (data.length < challengeLength) { return null; }
        let challenge: string = data.splice(0, challengeLength)
                                    .map(x => fillHexString(x.toString(16).toUpperCase()))
                                    .reduce(sumUp, "");

        var signatureLength: number = 0
        var signature: string = "";
        if (headerConstraints.signed) {
            signatureLength = 64;
            if (data.length < signatureLength) { return null; }
            signature = data.splice(0, signatureLength)
                            .map(x => fillHexString(x.toString(16).toUpperCase()))
                            .reduce(sumUp, "");
        }

        let frame = {
            encrypted: headerConstraints.encrypted,
            signed: headerConstraints.signed,
            opcode: headerByte & 0x3F,
            payloadLength: payloadLength,
            payload: payload,
            challengeLength: challengeLength,
            challenge: challenge,
            signatureLength: signatureLength,
            signature: signature,
            valid: false,
            leftoverBytes: data.length,
        }

        if (payload.length >= headerConstraints.minPayloadLength
            && payload.length <= headerConstraints.maxPayloadLength) {
            frame.valid = true;
        }

        return frame;
    }
}

namespace MessageFrameV0 {
    export function decode(data: Array<number>): MessageFrameV0 | null {
        if (data.length < 3) { return null; }

        let version: number | undefined = data.shift();
        if (version == undefined) { return null; }

        let flags: number | undefined = data.shift();
        if (flags == undefined) { return null; }

        let payloadLength = data.splice(0, 2)
                                .map((val, index) => mapByteAtIndexToNumber(val, index, 2))
                                .reduce(sumUp, 0);
        if (data.length < payloadLength) { return null; }

        let payload: string = data.splice(0, payloadLength)
                                    .map(x => fillHexString(x.toString(16).toUpperCase()))
                                    .reduce(sumUp, "");

        var signature: string = "";
        var signatureKeyId: number = NaN;
        var signatureLength: number = 0;
        if (data.length >= 66) {
            signatureLength = 64;
            signature = data.splice(0, signatureLength)
                            .map(x => fillHexString(x.toString(16).toUpperCase()))
                            .reduce(sumUp, "");
            signatureKeyId = data.splice(0, 2)
                                .map((val, index) => mapByteAtIndexToNumber(val, index, 2))
                                .reduce(sumUp);
        }

        let frame = {
            version: 0,
            flags: flags,
            payloadLength: payloadLength,
            payload: payload,
            signatureLength: signatureLength,
            signature: signature,
            signatureKeyId: signatureKeyId,
            valid: false,
            leftoverBytes: data.length,
        };

        if (flags == 0) { frame.valid = true; }
        return frame;
    }
}

namespace MessageFrameV1 {
    export function decode(data: Array<number>): MessageFrameV1 | null {
        if (data.length < 12) { return null; }

        let version: number | undefined = data.shift();
        if (version == undefined) { return null; }

        let headerByte: number | undefined = data.shift();
        if (headerByte == undefined) { return null; }

        let headerConstraints = opcodeV1Lookup[headerByte];
        if (!headerConstraints) { return null; }

        let payloadLength = data.splice(0, 2)
                                .map((val, index) => mapByteAtIndexToNumber(val, index, 2))
                                .reduce(sumUp);
        if (data.length < payloadLength) { return null; }

        let payload = data.splice(0, payloadLength)
                            .map(x => fillHexString(x.toString(16).toUpperCase()))
                            .reduce(sumUp, "");

        var signatureLength: number = 0;
        var signature: string = "";
        var signatureKeyId: number = NaN;
        if (headerConstraints.signed) {
            if (data.length < 66) { return null; }
            signatureLength = 64;
            signature = data.splice(0, signatureLength)
                            .map(x => fillHexString(x.toString(16).toUpperCase()))
                            .reduce(sumUp, "");
            signatureKeyId = data.splice(0, 2)
                                .map((val, index) => mapByteAtIndexToNumber(val, index, 2))
                                .reduce(sumUp);
        }

        if (data.length < 8) { return null; }
        let timestamp = data.splice(0, 8)
                            .map((val, index) => mapByteAtIndexToNumber(val, index, 8))
                            .reduce(sumUp);

        let frame = {
            version: 1,
            encrypted: headerConstraints.encrypted,
            signed: headerConstraints.signed,
            opcode: headerByte & 0x3F,
            payloadLength: payloadLength,
            payload: payload,
            signatureLength: signatureLength,
            signature: signature,
            signatureKeyId: signatureKeyId,
            timestamp: timestamp,
            valid: false,
            leftoverBytes: data.length,
        };

        if (payload.length >= headerConstraints.minPayloadLength
            && payload.length <= headerConstraints.maxPayloadLength) {
            frame.valid = true;
        }

        return frame;
    }
}

namespace MessageFrameV2 {
    export function decode(data: Array<number>): MessageFrameV2 | null {
        if (data.length < 4) { return null; }

        let version: number | undefined = data.shift();
        if (version == undefined) { return null; }

        let headerByte: number | undefined = data.shift();
        if (headerByte == undefined) { return null; }

        let headerConstraints = opcodeV2Lookup[headerByte];
        if (!headerConstraints) { return null; }

        let payloadLength = data.splice(0, 2)
                                .map((val, index) => mapByteAtIndexToNumber(val, index, 2))
                                .reduce(sumUp);
        if (data.length < payloadLength) { return null; }

        let payload = data.splice(0, payloadLength)
                            .map(x => fillHexString(x.toString(16).toUpperCase()))
                            .reduce(sumUp, "");

        var signatureLength: number = 0;
        var signature: string = "";
        if (headerConstraints.signed) {
            signatureLength = data.splice(0, 2)
                                    .map((val, index) => mapByteAtIndexToNumber(val, index, 2))
                                    .reduce(sumUp);
            if (data.length < signatureLength) { return null; }

            signature = data.splice(0, signatureLength)
                            .map(x => fillHexString(x.toString(16).toUpperCase()))
                            .reduce(sumUp, "");
        }

        let frame = {
            version: 2,
            encrypted: headerConstraints.encrypted,
            signed: headerConstraints.signed,
            opcode: headerByte & 0x3F,
            payloadLength: payloadLength,
            payload: payload,
            signatureLength: signatureLength,
            signature: signature,
            valid: false,
            leftoverBytes: data.length,
        };

        if (payload.length >= headerConstraints.minPayloadLength
            && payload.length <= headerConstraints.maxPayloadLength) {
            frame.valid = true;
        }

        return frame;
    }
}

function parseHexString(str: string): Array<number> {
    var result = [];

    while (str.length >= 2) {
        result.push(parseInt(str.substring(0, 2), 16) & 0xFF);
        str = str.substring(2, str.length);
    }

    return result;
}

function hexToBytes(data: string): Array<number> | null {
    var result = data.replace(/(0x)/gm, '').replace(/[^0-9a-fA-F]/gm, '');
    if (result.length == 0 || result.length % 2 != 0) {
        return null;
    }

    return parseHexString(result);
}

function checkSelection(data: string): boolean {
    return data.trim().match(/^\[?(\s*(0x)?[0-9a-fA-F]+\s*,?)+\]?$/gm) != null;
}

function makeStringHexOnly(data: string): string {
    return data.replace(/(0x)/gm, '').replace(/[^0-9a-fA-F]/gm, '');
}

function isParsable(message: string): boolean {
    if (checkSelection(message)) {
        let result = makeStringHexOnly(message);
        if (result.length != 0 && result.length % 2 == 0) {
            return true;
        }
    }

    return false;
}

export class MessageFrameParsing extends Toolkit.ASelectionParser {

    public parse(str: string, _themeTypeRef: Toolkit.EThemeType): string {
        try {
            let bytes: number[] | null = hexToBytes(makeStringHexOnly(str));
            if (!bytes) { return "Selection not of proper size"}

            switch (bytes[0]) {
                case 0:
                    let frameV0: MessageFrameV0 | null = MessageFrameV0.decode(bytes);
                    if (frameV0) {
                        return "".concat(`FrameVersion: ${frameV0.version}\n`)
                            .concat(`Flags: ${frameV0.flags}\n`)
                            .concat(`Payload-Length: ${frameV0.payloadLength}\n`)
                            .concat(frameV0.payloadLength == 0 ? "" : `Payload: 0x${frameV0.payload}\n`)
                            .concat(`Signature-Length: ${frameV0.signatureLength}\n`)
                            .concat(frameV0.signatureLength == 0 ? "" : `Signature: 0x${frameV0.signature}\n`)
                            .concat(`Valid: ${frameV0.valid}\n`)
                            .concat(`Excess bytes: ${frameV0.leftoverBytes}`);
                    }
                    break;
                case 1:
                    let frameV1: MessageFrameV1 | null = MessageFrameV1.decode(bytes);
                    if (frameV1) {
                        let headerByteV1: OpcodeV1 = (frameV1.encrypted? 0x80 : 0) + (frameV1.signed? 0x40 : 0) + frameV1.opcode;

                        var out = "".concat(`FrameVersion: ${frameV1.version}\n`)
                            .concat(`Opcode: ${frameV1.opcode} (${OpcodeV1[headerByteV1]})\n`)
                            .concat(`Encrypted: ${frameV1.encrypted}\n`)
                            .concat(`Signed: ${frameV1.signed}\n`)
                            .concat(`Payload-Length: ${frameV1.payloadLength}\n`)
                            .concat(frameV1.payloadLength == 0 ? "" : `Payload: 0x${frameV1.payload}\n`)
                            .concat(`Signature-Length: ${frameV1.signatureLength}\n`)
                            .concat(frameV1.signatureLength == 0 ? "" : `Signature: 0x${frameV1.signature}\n`)
                            .concat(frameV1.signatureLength == 0 ? "" : `SignatureKeyId: ${frameV1.signatureKeyId}\n`);

                            try {
                                out += `Timestamp: ${frameV1.timestamp}`;
                                out += ` (${new Date(frameV1.timestamp).toISOString()})\n`;
                            } catch (e) {
                                out += "\n";
                            }

                        return out.concat(`Valid: ${frameV1.valid}\n`).concat(`Excess bytes: ${frameV1.leftoverBytes}`);
                    }
                    break;
                case 2:
                    let frameV2: MessageFrameV2 | null = MessageFrameV2.decode(bytes);
                    if (frameV2) {
                        let headerByteV2: OpcodeV2 = (frameV2.encrypted? 0x80 : 0) + (frameV2.signed? 0x40 : 0) + frameV2.opcode;
                        return "".concat(`FrameVersion: ${frameV2.version}\n`)
                            .concat(`Opcode: ${frameV2.opcode} (${OpcodeV2[headerByteV2]})\n`)
                            .concat(`Encrypted: ${frameV2.encrypted}\n`)
                            .concat(`Signed: ${frameV2.signed}\n`)
                            .concat(`Payload-Length: ${frameV2.payloadLength}\n`)
                            .concat(frameV2.payloadLength == 0 ? "" : `Payload: 0x${frameV2.payload}\n`)
                            .concat(`Signature-Length: ${frameV2.signatureLength}\n`)
                            .concat(frameV2.signatureLength == 0 ? "" : `Signature: 0x${frameV2.signature}\n`)
                            .concat(`Valid: ${frameV2.valid}\n`)
                            .concat(`Excess bytes: ${frameV2.leftoverBytes}`);
                    }
                    break;
            };

            let frameCsm4: MessageFrameCsm4 | null = MessageFrameCsm4.decode(bytes);
            if (frameCsm4) {
                let headerByteCsm4: OpcodeV2 = (frameCsm4.encrypted? 0x80 : 0) + (frameCsm4.signed? 0x40 : 0) + frameCsm4.opcode;
                return "".concat("FrameVersion: CSM4\n")
                    .concat(`Opcode: ${frameCsm4.opcode} (${OpcodeCsm4[headerByteCsm4]})\n`)
                    .concat(`Encrypted: ${frameCsm4.encrypted}\n`)
                    .concat(`Signed: ${frameCsm4.signed}\n`)
                    .concat(`Payload-Length: ${frameCsm4.payloadLength}\n`)
                    .concat(frameCsm4.payloadLength == 0 ? "" : `Payload: 0x${frameCsm4.payload}\n`)
                    .concat(`Challenge-Length: ${frameCsm4.challengeLength}\n`)
                    .concat(frameCsm4.challengeLength == 0 ? "" : `Challenge: 0x${frameCsm4.challenge}\n`)
                    .concat(`Signature-Length: ${frameCsm4.signatureLength}\n`)
                    .concat(frameCsm4.signatureLength == 0 ? "" : `Signature: 0x${frameCsm4.signature}\n`)
                    .concat(`Valid: ${frameCsm4.valid}\n`)
                    .concat(`Excess bytes: ${frameCsm4.leftoverBytes}`);
            }
        } catch(e) {
            return "Illegal frame composition";
        }

        return "Cannot parse this selection";
    }

    public getParserName(str: string): string | undefined {
        return isParsable(str) ? "Parse as MessageFrame" : undefined;
    }
}
