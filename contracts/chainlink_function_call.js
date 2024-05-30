const { format } = await import("https://deno.land/std@0.91.0/datetime/mod.ts");
const { v4 } = await import("https://deno.land/std/uuid/mod.ts");
const uuidv4 = v4;


// Hashes a msg with SHA256.
async function makeBoundary() {
    const stamp = format(new Date(), "yyyy-MM-ddTHH:mm:ss");
    const data = new TextEncoder().encode("FileBoundary" + stamp);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return "----WebKitFormBoundary" + hash;
}


function createMultipartData(fileContent, fileName) {
    const boundary = makeBoundary();
    const formData = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="files"; filename="${fileName}"`,
        `Content-Type: application/octet-stream`,
        "",
        fileContent,
        `--${boundary}--`,
        "",
    ];
    return {
        boundary,
        body: formData.join("\r\n"),
    };
}


// Gets the score of a document.
function getScore(statusCode, body) {
    switch(statusCode) {
        case 200:
            let document = body.documents[0];
            return parseInt(document.average_generated_prob * 100);
        default:
            console.log("Status code is:", statusCode, "body:", body);
            return null;
    }
}


// Evaluates the file against gptzero API. On error, it returns
// 255 (0xff). On success, otherwise, it returns a value between
// 0 and 100.
async function gptZeroRequest({fileName, fileContent}) {
    const apiKey = secrets.apiKey;
    if (!apiKey) return null;

    const { boundary, body } = createMultipartData(fileContent, fileName);
    const url = "https://api.gptzero.me/v2/predict/files";
    const method = "POST";
    const headers = {
        "Accept": "application/json",
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "x-api-key": apiKey
    }

    const response = await Functions.makeHttpRequest({
        url: url, method: method, headers: headers, data: body
    });
    if (response.error) {
        console.log("Error:", response);
        return 0xff;
    } else {
        const data = response.data;
        const statusCode = response.status;
        const result = getScore(statusCode, data);
        if (result === null) {
            return 0xff;
        } else {
            return result;
        }
    }
}


async function downloadFile(url) {
    // Fetch the file from the URL
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
    }

    // Generate a unique filename
    const fileName = `${uuidv4.generate()}.tmp`;

    // Read the response body
    const fileContent = await response.text();

    // Return everything as string
    return {fileName, fileContent};
}


return Functions.encodeUint256(await gptZeroRequest(downloadFile(
    "http://bibliotecadigital.ilce.edu.mx/Colecciones/ObrasClasicas/_docs/Elcolorsurgidodelespacio.pdf"
)));
