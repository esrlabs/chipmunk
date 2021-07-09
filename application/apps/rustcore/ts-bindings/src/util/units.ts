class Greeter {
    greeting: string;
    constructor(message: string) {
        this.greeting = message;
    }
    greet() {
        return "Hello, " + this.greeting;
    }
}

export class TimeUnit {
    nanoseconds: number;
    constructor(inNs: number) {
        this.nanoseconds = inNs;
    }

    setMilliseconds(ms: number): TimeUnit {
        this.nanoseconds = 1000 * ms;
        return this;
    }

    setSeconds(s: number): TimeUnit {
        this.nanoseconds = 1000 * 1000 * 1000 * s;
        return this;
    }

    /// create a TimeUnit that represents empty (0 ns)
    static zero(): TimeUnit {
        return new TimeUnit(0);
    }

    /// create a TimeUnit by specifiing the amount of minutes it should represent
    static fromMinutes(minutes: number): TimeUnit {
        return TimeUnit.fromSeconds(60 * minutes);
    }

    /// create a TimeUnit by specifiing the amount of seconds it should represent
    static fromSeconds(seconds: number): TimeUnit {
        return TimeUnit.fromMilliseconds(1000 * seconds);
    }

    /// create a TimeUnit by specifiing the amount of milliseconds it should represent
    static fromMilliseconds(ms: number): TimeUnit {
        return TimeUnit.fromNanoseconds(1000 * ms);
    }

    /// create a TimeUnit by specifiing the amount of nanoseconds it should represent
    static fromNanoseconds(ns: number): TimeUnit {
        return new TimeUnit(ns);
    }

    inNanoseconds(): number {
        return this.nanoseconds
    }

    inMilliseconds(): number {
        return this.nanoseconds / 1000.0
    }

    inSeconds(): number {
        return this.nanoseconds / 1000.0 / 1000.0
    }

}
