export async function readJsonResponse(response: Response): Promise<unknown> {
    return response.clone().json();
}

export async function readTextResponse(response: Response): Promise<string> {
    return response.clone().text();
}

export async function readBlobResponse(response: Response): Promise<Blob> {
    return response.clone().blob();
}
