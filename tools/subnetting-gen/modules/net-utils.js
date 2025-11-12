/*
 * Archivo: /tools/subnetting-gen/modules/net-utils.js
 * Utilidades puras para manipulación y validación de IPs, máscaras y CIDR.
 */
"use strict";

/**
 * Convierte una cadena de IP (ej. "192.168.1.1") a un entero de 32 bits.
 */
export function ipToLong(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

/**
 * Convierte un entero de 32 bits a una cadena de IP.
 */
export function longToIp(long) {
    return [
        (long >>> 24) & 255,
        (long >>> 16) & 255,
        (long >>> 8) & 255,
        long & 255
    ].join('.');
}

/**
 * Convierte un entero de 32 bits a una cadena binaria simple de 32 caracteres.
 * Ej: 2886795265 -> "10101100000101000110010000000101"
 */
export function longToPaddedBinaryString(long) {
    return (long >>> 0).toString(2).padStart(32, '0');
}

/**
 * Formatea una cadena binaria de 32 bits con espacios de nibble (total 9 chars por octeto).
 * Ej: "11111111" -> "1111 1111"
 */
function formatBinaryOctet(binaryStr) {
    return binaryStr.substring(0, 4) + ' ' + binaryStr.substring(4, 8);
}

/**
 * Formatea una cadena DDN para alineación (total 9 chars por octeto).
 * Ej: "255" -> "   255   "
 */
function formatDecimalOctet(decimalStr) {
    const len = decimalStr.length;
    const paddingLeft = Math.floor((9 - len) / 2);
    const paddingRight = Math.ceil((9 - len) / 2);
    return ' '.repeat(paddingLeft) + decimalStr + ' '.repeat(paddingRight);
}

/**
 * Formatea una cadena binaria de 32 bits con espacios de nibble y puntos de octeto.
 * Ej: "11111111111111111111111111111100" -> "1111 1111.1111 1111.1111 1111.1111 1100"
 */
export function formatBinaryWithNibbles(binaryStr) {
    const octets = binaryStr.match(/.{1,8}/g);
    return octets.map(formatBinaryOctet).join('.');
}

/**
 * Formatea una cadena DDN para alineación en <pre> (9 espacios por octeto).
 * Ej: "255.255.255.252" -> "   255   .   255   .   255   .   252   "
 */
export function formatDecimalAsOctets(decimalStr) {
    const octets = decimalStr.split('.');
    return octets.map(formatDecimalOctet).join('.');
}

/**
 * Convierte un prefijo CIDR (ej. 24) a un entero de máscara de subred.
 */
export function cidrToMaskLong(cidr) {
    return (0xFFFFFFFF << (32 - cidr)) >>> 0;
}

/**
 * Convierte una máscara de subred (entero) a su prefijo CIDR.
 */
export function maskLongToCidr(maskLong) {
    let cidr = 0;
    let mask = maskLong;
    while (mask & 0x80000000) {
        cidr++;
        mask <<= 1;
    }
    return cidr;
}

/**
 * Valida un formato de dirección IP.
 */
export function validateIp(ip) {
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
}

/**
 * Valida un formato CIDR (ej. "192.168.1.0/24").
 */
export function validateCidr(cidrStr) {
    const cidrRegex = /^([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})\/([0-9]{1,2})$/;
    const match = cidrStr.match(cidrRegex);
    if (!match) return false;

    const ip = match[1];
    const prefix = parseInt(match[2], 10);

    return validateIp(ip) && prefix >= 0 && prefix <= 32;
}

/**
 * Obtiene la clase de red (A, B, C, D, E) de una IP.
 */
export function getNetworkClass(ip) {
    const firstOctet = parseInt(ip.split('.')[0], 10);
    if (firstOctet >= 1 && firstOctet <= 126) return 'A';
    if (firstOctet === 127) return 'Loopback';
    if (firstOctet >= 128 && firstOctet <= 191) return 'B';
    if (firstOctet >= 192 && firstOctet <= 223) return 'C';
    if (firstOctet >= 224 && firstOctet <= 239) return 'D';
    if (firstOctet >= 240 && firstOctet <= 255) return 'E';
    return 'Invalid';
}

/**
 * Obtiene la máscara de subred por defecto para una clase de red.
 */
export function getDefaultMask(networkClass) {
    switch (networkClass) {
        case 'A': return { mask: '255.0.0.0', cidr: 8, maskLong: cidrToMaskLong(8) };
        case 'B': return { mask: '255.255.0.0', cidr: 16, maskLong: cidrToMaskLong(16) };
        case 'C': return { mask: '255.255.255.0', cidr: 24, maskLong: cidrToMaskLong(24) };
        default: return null;
    }
}

/**
 * Genera un entero aleatorio entre min y max (inclusivos).
 */
export function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calcula la ruta de resumen más eficiente para una lista de direcciones IP.
 * @param {string[]} ipList - Un array de direcciones IP en formato string (ej. ["192.168.0.0", "192.168.1.0"])
 * @returns {{network: string, prefix: number, mask: string} | null} - El objeto de la ruta de resumen.
 */
export function findSummaryRoute(ipList) {
    if (!ipList || ipList.length === 0) {
        return null;
    }

    // 1. Convertir todas las IPs a números (longs)
    const ipLongs = ipList.map(ipToLong);

    // 2. Encontrar la dirección IP más baja y la más alta
    const minIp = Math.min(...ipLongs) >>> 0;
    const maxIp = Math.max(...ipLongs) >>> 0;

    // 3. Encontrar los bits diferentes usando XOR
    const xorResult = (minIp ^ maxIp) >>> 0;

    // 4. Encontrar la longitud de los bits comunes (prefijo)
    // Contamos cuántos bits se necesitan para representar la diferencia (xorResult).
    // La longitud en binario del xorResult nos dice cuántos bits *difieren* desde la derecha.
    const differingBits = xorResult.toString(2).length;
    const prefix = 32 - differingBits;

    // 5. Calcular la nueva máscara y la dirección de red
    const newMaskLong = cidrToMaskLong(prefix);
    const newNetworkLong = (minIp & newMaskLong) >>> 0;

    return {
        network: longToIp(newNetworkLong),
        prefix: prefix,
        mask: longToIp(newMaskLong)
    };
}