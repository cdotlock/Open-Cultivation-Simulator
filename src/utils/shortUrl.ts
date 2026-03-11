const base62 = [
    'K', '7', 'm', 'N', '3', 'p', 'Q', 'r', 'S', 't',
    'U', 'v', 'W', 'x', 'Y', 'z', 'A', 'b', 'C', 'd',
    'E', '_', 'G', 'h', 'I', 'j', 'k', 'L', 'M', 'n',
    'O', 'P', 'q', 'R', 's', 'T', 'u', 'V', 'w', 'X',
    'y', 'Z', '0', '1', '4', '2', '6', '5', '8', 'J',
    'a', 'B', 'c', 'D', 'e', 'F', 'g', 'H', 'i', '9',
    '-', 'f'
]

// 4的倍数
const MASK = 0x5C40

/**
 * 将自增ID转换为混淆后的ID
 * @param id 原始自增ID
 * @returns 混淆后的ID
 */
export function obfuscateId(id: number): number {
    // Ensure symmetric bit shifts and rotations
    const shiftedId1 = ((id << 5) | (id >>> 27)) >>> 0;
    const shiftedId2 = ((shiftedId1 << 13) | (shiftedId1 >>> 19)) >>> 0;
    return (shiftedId2 + MASK) >>> 0;
}

/**
 * 将混淆后的ID转换回原始ID
 * @param obfuscatedId 混淆后的ID
 * @returns 原始ID
 */
export function deobfuscateId(obfuscatedId: number): number {
    const shiftedId2 = (obfuscatedId - MASK) >>> 0;
    // Reverse the bit shifts and rotations symmetrically
    const shiftedId1 = ((shiftedId2 >>> 13) | (shiftedId2 << 19)) >>> 0;
    return ((shiftedId1 >>> 5) | (shiftedId1 << 27)) >>> 0;
}

/**
 * 将数字转换为6位base62编码字符串
 * @param num 要编码的数字
 * @returns 6位base62编码字符串
 */
export function encodeBase62(num: number): string {
    if (num < 0 || !Number.isInteger(num)) {
        throw new Error('Number must be a positive integer');
    }

    let result = '';
    let n = num;

    // 确保生成6位编码
    for (let i = 0; i < 6; i++) {
        const remainder = n % 62;

        result = base62[remainder] + result;
        n = Math.floor(n / 62);
    }

    return result;
}

/**
 * 将base62编码字符串转换回数字
 * @param str base62编码字符串
 * @returns 解码后的数字
 */
export function decodeBase62(str: string): number {
    if (!str || str.length !== 6) {
        throw new Error('Input must be a 6-character base62 string');
    }

    let result = 0;

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const value = base62.indexOf(char);

        if (value === -1) {
            throw new Error(`Invalid base62 character: ${char}`);
        }
        result = result * 62 + value;
    }

    return result;
}

/**
 * 将原始ID转换为6位base62编码字符串
 * @param id 原始ID
 * @returns 6位base62编码字符串
 */
export function idToShortUrl(id: number): string {
    if (id < 0 || !Number.isInteger(id)) {
        throw new Error('ID must be a positive integer');
    }
    const obfuscatedId = obfuscateId(id);
    return encodeBase62(obfuscatedId);
}

/**
 * 将6位base62编码字符串转换回原始ID
 * @param shortUrl 6位base62编码字符串
 * @returns 原始ID
 */
export function shortUrlToId(shortUrl: string): number {
    if (!shortUrl || shortUrl.length !== 6) {
        throw new Error('Short URL must be a 6-character string');
    }
    const obfuscatedId = decodeBase62(shortUrl);
    return deobfuscateId(obfuscatedId);
}

// console.log(obfuscateId(8192))


// 测试代码
// for (let i = 1; i <= 100; i++) {
//     try {
//         const shortUrl = idToShortUrl(i);
//         const decodedId = shortUrlToId(shortUrl);
//         console.log(`ID: ${i}, Short URL: ${shortUrl}, Decoded ID: ${decodedId}`);
//         if (decodedId !== i) {
//             console.error(`Mismatch at ID ${i}: ${decodedId}`);
//             break;
//         }
//     } catch (error) {
//         console.error(`Error at ID ${i}:`, error);
//         break;
//     }
// }