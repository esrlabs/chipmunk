type UuidGetter = () => string;

class Sequence {
    private _sequence: number = 0;
    private _uuid: UuidGetter | undefined;

    public sequence(): number {
        return this._sequence++;
    }

    public getUnique(): string {
        return this._uuid !== undefined ? this._uuid() : `sequence:${this.sequence()}`;
    }

    public setUuidGenerator(generator: UuidGetter) {
        this._uuid = generator;
    }
}

const sequence = new Sequence();

export function setUuidGenerator(generator: UuidGetter) {
    sequence.setUuidGenerator(generator);
}

export function unique(): string {
    return sequence.getUnique();
}

export function getSequence(): number {
    return sequence.sequence();
}
