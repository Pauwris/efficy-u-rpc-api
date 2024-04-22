export function parseEfficyCookieString(cookieStr: string) {
    const keyValuePairs = cookieStr.split(';');

    let name: string = "EfficySession";
    let value: string = "";
    let path: string = "";
    let expires: string = "";

    for (const pair of keyValuePairs) {
        const [key, _value] = pair.trim().split('=');
        if (key === "EfficySession") {
            value = decodeURIComponent(_value);
        }
        if (key === "path") {
            path = decodeURIComponent(_value);
        }
        if (key === "expires") {
            expires = decodeURIComponent(_value);
        }
    }

    return {
        name,
        value,
        path,
        expires
    };
}
