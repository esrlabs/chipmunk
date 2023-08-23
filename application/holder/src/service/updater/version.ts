export class Version {
    public readonly parts: number[];

    constructor(version: string, prefix = '') {
        this.parts = version
            .replace(prefix, '')
            .split('.')
            .map((part: string) => {
                return parseInt(part, 10);
            })
            .filter((value: number) => {
                return isNaN(value) ? false : isFinite(value);
            });
        if (this.parts.length !== 3) {
            throw new Error(`Invalid version format. Expecting xxx.yyy.zzz`);
        }
    }

    public ver(): {
        major(): number;
        minor(): number;
        patch(): number;
    } {
        return {
            major: (): number => {
                return this.parts[0];
            },
            minor: (): number => {
                return this.parts[1];
            },
            patch: (): number => {
                return this.parts[2];
            },
        };
    }

    public isGivenGrander(version: Version): boolean {
        const diff: number[] = this.parts.map((xxx: number, i: number) => {
            return version.parts[i] - xxx;
        });
        if (diff[0] > 0) {
            return true;
        }
        if (diff[0] === 0 && diff[1] > 0) {
            return true;
        }
        if (diff[0] === 0 && diff[1] === 0 && diff[2] > 0) {
            return true;
        }
        return false;
    }

    public isGivenSame(version: Version): boolean {
        const diff: number[] = this.parts.map((xxx: number, i: number) => {
            return version.parts[i] - xxx;
        });
        return diff[0] + diff[1] + diff[2] === 0;
    }
}
