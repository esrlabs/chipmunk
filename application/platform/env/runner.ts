import { unique } from './sequence';

type TaskExecutor<T> = () => Promise<T>;
type Resolver<T> = (res: T) => void;
type Rejector = (err: Error) => void;

export class Task<T> {
    constructor(
        protected readonly uuid: string,
        protected readonly executor: TaskExecutor<T>,
        protected readonly success: Resolver<T>,
        protected readonly fail: Rejector,
    ) {}
    public proceed(): Promise<void> {
        return new Promise((resolve) => {
            this.executor()
                .then((res: T) => {
                    this.success(res);
                })
                .catch((err: Error) => {
                    this.fail(err);
                })
                .finally(() => {
                    resolve();
                });
        });
    }
}

export class Queue {
    protected readonly tasks: Task<any>[] = [];
    protected working: boolean = false;
    protected proceed() {
        if (this.working) {
            return;
        }
        if (this.tasks.length === 0) {
            return;
        }
        this.working = true;
        const task: Task<unknown> = this.tasks.splice(0, 1)[0];
        task.proceed()
            .catch((err: Error) => {
                console.error(err);
            })
            .finally(() => {
                setTimeout(() => {
                    this.working = false;
                    this.proceed();
                }, this.delay);
            });
    }

    constructor(protected readonly delay: number) {}

    public wait<T>(executor: TaskExecutor<T>): Promise<T> {
        return new Promise((resolve: Resolver<T>, reject: Rejector) => {
            this.tasks.push(new Task<T>(unique(), executor, resolve, reject));
            this.proceed();
        });
    }
}
