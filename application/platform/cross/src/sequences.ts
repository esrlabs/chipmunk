export function sequences(pendings: Array<(...args: any[]) => Promise<any>>): Promise<any> {
    return new Promise((resolveSequence, rejectSequence) => {
        function next(output: any) {
            // Get first promise creator
            const promise: Promise<any> = pendings[0](output);
            // Remove promise creator from queue
            pendings.splice(0, 1);
            // Taking result of promise
            promise.then((result: any) => {
                if (pendings.length > 0) {
                    // If we still have promises in quere
                    return next(result);
                } else {
                    // All tasks in queue is done
                    resolveSequence(result);
                }
            }).catch((error: Error) => {
                // Some pendin task wasn't done. Stop queue.
                rejectSequence(error);
            });
        }
        next(undefined);
    });
}
