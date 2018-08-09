export function openLocalFile(filename: string ): Promise<string>{
    return new Promise<string>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("GET", `file://${filename}`, false);
        request.onreadystatechange = () => {
            if(request.readyState === 4) {
                if(request.status === 200 || request.status == 0) {
                    return resolve(request.responseText);
                }
            }
        };
        request.send(null);
    });
}
