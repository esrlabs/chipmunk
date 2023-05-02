export class URLFileReader {
    protected url: string;
    protected readonly request: XMLHttpRequest = new XMLHttpRequest();
    protected done: boolean = false;

    constructor(url: string) {
        this.url = url;
    }

    public read(
        responseType?: 'blob' | 'arraybuffer' | 'document' | 'json' | 'text',
    ): Promise<string | Blob | ArrayBuffer | { [key: string]: any } | Document> {
        return new Promise((resolve, reject) => {
            this.request.open('GET', this.url, true);
            responseType !== undefined && (this.request.responseType = responseType);
            this.request.send(null);
            this.request.onreadystatechange = () => {
                if (this.done) {
                    return;
                }
                if (this.request.readyState !== this.request.DONE) {
                    return;
                }
                this.done = true;
                if (this.request.status !== 200) {
                    return reject(new Error(`Fail to get response`));
                }
                switch (this.request.responseType) {
                    case 'arraybuffer':
                        resolve(this.request.response as ArrayBuffer);
                        break;
                    case 'blob':
                        resolve(this.request.response as Blob);
                        break;
                    case 'json':
                        resolve(this.request.response as { [key: string]: any });
                        break;
                    case 'document':
                        resolve(this.request.response as Document);
                        break;
                    case 'text':
                    case '':
                        resolve(this.request.responseText);
                        break;
                }
            };
        });
    }
}
