/**
 * ipUtils.js - Biblioteca de funciones de utilidad para la manipulación de direcciones IPv4 y máscaras de subred.
 */

/**
 * Verifica si una cadena de texto representa una dirección IPv4 válida.
 * @param {string} ipString - La cadena de texto a validar.
 * @returns {boolean} True si la cadena es una dirección IPv4 válida, false en caso contrario.
 */
function isValidIp(ipString) {
    if (typeof ipString !== 'string' || ipString.trim() === '') {
        return false;
    }
    // Expresión regular para estructura básica y rango de octetos 0-255
    // Previene ceros a la izquierda a menos que el octeto sea "0"
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ipString)) {
        return false;
    }
    // Doble verificación de partes para ceros inválidos a la izquierda como 01, 001 etc.
    const octets = ipString.split('.');
    return octets.every(octet => octet === '0' || !octet.startsWith('0') || octet.length === 1);
}

/**
 * Convierte una cadena de IPv4 válida ("192.168.1.1") a su representación entera de 32 bits.
 * Trata los 32 bits como sin signo.
 * @param {string} ipString - La cadena de la dirección IPv4.
 * @returns {number|null} El entero de 32 bits sin signo, o null si la entrada es inválida.
 */
function ipToInt(ipString) {
    if (!isValidIp(ipString)) {
        console.error(`Cadena IP inválida para ipToInt: ${ipString}`);
        return null;
    }
    const octets = ipString.split('.').map(Number);
    // Desplaza los octetos a su lugar y combina usando OR a nivel de bits
    // Usa >>> 0 para asegurar que el resultado sea tratado como sin signo de 32 bits
    return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
}

/**
 * Convierte una representación entera de 32 bits de una dirección IPv4 a su formato de cadena.
 * Maneja el entero como sin signo.
 * @param {number} ipInt - El entero de 32 bits sin signo.
 * @returns {string} La cadena de la dirección IPv4 (ej: "192.168.1.1").
 */
function intToIp(ipInt) {
    // Asegura que la entrada sea tratada como número, maneja entradas no numéricas con gracia
    const num = Number(ipInt);
    if (isNaN(num)) {
        console.error("Número inválido proporcionado a intToIp:", ipInt);
        return "0.0.0.0"; // O lanza un error, dependiendo de la rigurosidad deseada
    }
    // Extrae los octetos usando desplazamiento a la derecha y AND a nivel de bits
    const oct1 = (num >>> 24) & 255;
    const oct2 = (num >>> 16) & 255;
    const oct3 = (num >>> 8) & 255;
    const oct4 = num & 255;
    return `${oct1}.${oct2}.${oct3}.${oct4}`;
}

/**
 * Verifica si una cadena representa una máscara de subred IPv4 válida.
 * Una máscara válida tiene unos contiguos seguidos de ceros contiguos.
 * @param {string} maskString - La cadena de la máscara a validar (ej: "255.255.255.0").
 * @returns {boolean} True si la cadena es una máscara de subred válida, false en caso contrario.
 */
function isValidMask(maskString) {
    if (!isValidIp(maskString)) { // Verificación básica de formato IP
        return false;
    }
    const maskInt = ipToInt(maskString);
    if (maskInt === null) return false; // No debería ocurrir si isValidIp pasó, pero por si acaso

    // Una máscara válida (cuando se invierten los bits) resulta en un número tal que
    // al sumarle 1 se convierte en una potencia de 2 (o 0 para /0).
    // Ejemplo: 255.255.255.0 -> int -> invertir -> 0.0.0.255 (255) -> +1 -> 256 (potencia de 2)
    // Ejemplo: 255.255.255.192 -> int -> invertir -> 0.0.0.63 (63) -> +1 -> 64 (potencia de 2)
    // Ejemplo: 255.255.255.255 -> int -> invertir -> 0.0.0.0 (0) -> +1 -> 1 (potencia de 2)
    // Ejemplo: 0.0.0.0 -> int -> invertir -> 255.255.255.255 (-1 ó 0xFFFFFFFF) -> +1 -> 0
    const inverted = (~maskInt) >>> 0;
    const plusOne = (inverted + 1) >>> 0;

    // Verifica si plusOne es potencia de 2 (o 0).
    // Un número x es potencia de 2 si (x & (x - 1)) === 0 (y x > 0).
    // También permitimos 0 para el caso /0 (inverted=0xFFFFFFFF, plusOne=0).
    // El caso /32 (inverted=0, plusOne=1) también es manejado por la fórmula.
    if (plusOne === 0) return true; // Maneja la máscara /0 (0.0.0.0)
    return (plusOne & (plusOne - 1)) === 0;
}


/**
 * Calcula la longitud del prefijo (/XX) a partir de una cadena de máscara de subred válida.
 * @param {string} maskString - La cadena de la máscara de subred (ej: "255.255.255.0").
 * @returns {number|null} La longitud del prefijo (0-32), o null si la máscara es inválida.
 */
function getPrefixLength(maskString) {
    if (!isValidMask(maskString)) {
         console.error(`Cadena de máscara inválida para getPrefixLength: ${maskString}`);
        return null;
    }
    const maskInt = ipToInt(maskString);
    if (maskInt === null) return null; // Ya debería haber sido detectado por isValidMask

    let prefix = 0;
    let maskCheck = maskInt;
    // Cuenta el número de bits activos (1s) de izquierda a derecha
    // Una forma alternativa sin bucles por rendimiento (quizás menos legible):
    // let count = 0;
    // let n = maskInt;
    // while (n !== 0) {
    //   n = n & (n - 1); // Algoritmo de Brian Kernighan para contar bits activos
    //   count++;
    // }
    // return count;
    // Mantengamos el bucle más claro por ahora:
    for (let i = 0; i < 32; i++) {
        if ((maskCheck & 0x80000000) === -2147483648) { // Verifica el bit más significativo
            prefix++;
            maskCheck <<= 1; // Desplaza a la izquierda para verificar el siguiente bit
        } else {
            break; // Detiene el conteo al encontrar un 0
        }
    }
    return prefix;
}

/**
 * Calcula la cadena de la máscara de subred a partir de la longitud del prefijo.
 * @param {number} prefix - La longitud del prefijo (0-32).
 * @returns {string|null} La cadena de la máscara de subred, o null si el prefijo es inválido.
 */
function getMaskStringFromPrefix(prefix) {
    if (prefix < 0 || prefix > 32 || !Number.isInteger(prefix)) {
        console.error(`Prefijo inválido para getMaskStringFromPrefix: ${prefix}`);
        return null;
    }
    if (prefix === 0) {
        return "0.0.0.0";
    }
    // Calcula el entero de la máscara: -1 desplazado a la izquierda por (32 - prefijo) bits
    // Usa >>> 0 para asegurar que el resultado sea tratado como sin signo de 32 bits
    const maskInt = ((-1 << (32 - prefix)) >>> 0);
    return intToIp(maskInt);
}

/**
 * Analiza (parsea) una cadena CIDR (ej: "192.168.1.0/24") en sus componentes.
 * @param {string} cidrString - La cadena en notación CIDR.
 * @returns {{ip: string, prefix: number, mask: string}|null} Un objeto con ip, prefijo y máscara, o null si es inválido.
 */
function parseIpAndPrefix(cidrString) {
    if (typeof cidrString !== 'string') return null;
    const parts = cidrString.split('/');
    if (parts.length !== 2) return null;

    const ip = parts[0];
    const prefixStr = parts[1];
    const prefix = parseInt(prefixStr, 10);

    if (!isValidIp(ip) || isNaN(prefix) || prefix < 0 || prefix > 32) {
        return null;
    }

    const mask = getMaskStringFromPrefix(prefix);
    if (!mask) return null; // No debería ocurrir si el prefijo es válido

    return { ip, prefix, mask };
}


/**
 * Calcula la dirección de red dada una IP y su máscara o prefijo.
 * @param {string} ipString - Una dirección IP dentro de la red.
 * @param {string|number} maskOrPrefix - La cadena de la máscara de subred o la longitud del prefijo.
 * @returns {string|null} La cadena de la dirección de red, o null si las entradas son inválidas.
 */
function getNetworkAddress(ipString, maskOrPrefix) {
    const ipInt = ipToInt(ipString);
    if (ipInt === null) return null;

    let maskInt;
    if (typeof maskOrPrefix === 'number') { // La entrada es prefijo
        const maskString = getMaskStringFromPrefix(maskOrPrefix);
        if (!maskString) return null;
        maskInt = ipToInt(maskString);
    } else if (typeof maskOrPrefix === 'string') { // La entrada es cadena de máscara
         if (!isValidMask(maskOrPrefix)) return null;
        maskInt = ipToInt(maskOrPrefix);
    } else {
        return null; // Tipo inválido para máscara/prefijo
    }

    if (maskInt === null) return null;

    const networkInt = (ipInt & maskInt) >>> 0;
    return intToIp(networkInt);
}

/**
 * Calcula la dirección de broadcast dada una dirección de red y su máscara o prefijo.
 * @param {string} networkString - La cadena de la dirección de red.
 * @param {string|number} maskOrPrefix - La cadena de la máscara de subred o la longitud del prefijo.
 * @returns {string|null} La cadena de la dirección de broadcast, o null si las entradas son inválidas.
 */
function getBroadcastAddress(networkString, maskOrPrefix) {
    const networkInt = ipToInt(networkString);
    if (networkInt === null) return null;

    let maskInt;
    let prefix;
    if (typeof maskOrPrefix === 'number') { // La entrada es prefijo
        prefix = maskOrPrefix;
        const maskString = getMaskStringFromPrefix(prefix);
        if (!maskString) return null;
        maskInt = ipToInt(maskString);
    } else if (typeof maskOrPrefix === 'string') { // La entrada es cadena de máscara
         if (!isValidMask(maskOrPrefix)) return null;
        maskInt = ipToInt(maskOrPrefix);
        prefix = getPrefixLength(maskOrPrefix); // Necesita prefijo para casos especiales
         if (prefix === null) return null;
    } else {
        return null; // Tipo inválido para máscara/prefijo
    }
    if (maskInt === null) return null;

    // Maneja /32 explícitamente - broadcast es igual a la dirección de red
    if (prefix === 32) {
        return networkString;
    }
    // Maneja /31 explícitamente - el concepto de broadcast estándar no aplica igual.
    // La fórmula estándar (Net | ~Mask) calcula la dirección superior del par /31.
    if (prefix === 31) {
        // networkInt | (~maskInt) dará la dirección superior en el par /31
        // ej. 192.168.1.0/31 -> Net=0, Mask=...FE, ~Mask=1 -> Broadcast=1 (Dirección superior)
    }

    // Wildcard = NOT máscara
    const wildcardInt = (~maskInt) >>> 0;
    const broadcastInt = (networkInt | wildcardInt) >>> 0;
    return intToIp(broadcastInt);
}

/**
 * Calcula la primera dirección IP de host utilizable en una subred.
 * Devuelve null para prefijos /31 y /32 ya que no tienen rango utilizable estándar.
 * @param {string} networkString - La cadena de la dirección de red.
 * @param {number} prefix - La longitud del prefijo de la red.
 * @returns {string|null} La cadena de la primera IP utilizable, o null.
 */
function getFirstUsableIp(networkString, prefix) {
    if (prefix < 0 || prefix > 30 || !Number.isInteger(prefix)) {
        // Solo /0 a /30 tienen un rango utilizable estándar > 0
        return null;
    }
    const networkInt = ipToInt(networkString);
    if (networkInt === null) return null;
    // La primera utilizable es dirección de red + 1
    const firstUsableInt = (networkInt + 1) >>> 0;
    return intToIp(firstUsableInt);
}

/**
 * Calcula la última dirección IP de host utilizable en una subred.
 * Devuelve null para prefijos /31 y /32.
 * @param {string} broadcastString - La cadena de la dirección de broadcast.
 * @param {number} prefix - La longitud del prefijo de la red.
 * @returns {string|null} La cadena de la última IP utilizable, o null.
 */
function getLastUsableIp(broadcastString, prefix) {
     if (prefix < 0 || prefix > 30 || !Number.isInteger(prefix)) {
        // Solo /0 a /30 tienen un rango utilizable estándar > 0
        return null;
    }
    const broadcastInt = ipToInt(broadcastString);
    if (broadcastInt === null) return null;
    // La última utilizable es dirección de broadcast - 1
    const lastUsableInt = (broadcastInt - 1) >>> 0;

    // Verificación de seguridad: asegura que la última utilizable no sea menor que red+1 (maneja caso /30)
    const networkInt = (broadcastInt & ipToInt(getMaskStringFromPrefix(prefix))) >>> 0;
    if(lastUsableInt <= networkInt) return null; // Solo debería ocurrir para /31, /32 ya están excluidos

    return intToIp(lastUsableInt);
}


/**
 * Calcula el número total de direcciones en una subred basado en la longitud del prefijo (2^(32-prefijo)).
 * @param {number} prefix - La longitud del prefijo (0-32).
 * @returns {number} El número total de direcciones, o 0 si el prefijo es inválido.
 */
function getTotalHosts(prefix) {
    if (prefix < 0 || prefix > 32 || !Number.isInteger(prefix)) {
        return 0;
    }
    const hostBits = 32 - prefix;
    // Para 2^32, el número estándar de JS es suficiente.
    return Math.pow(2, hostBits);
}

/**
 * Calcula el número de direcciones de host utilizables en una subred (Total - 2).
 * Devuelve 0 para prefijos /31 y /32.
 * @param {number} prefix - La longitud del prefijo (0-32).
 * @returns {number} El número de direcciones de host utilizables (mínimo 0).
 */
function getUsableHosts(prefix) {
    if (prefix < 0 || prefix > 30 || !Number.isInteger(prefix)) {
        // Definición estándar: hosts utilizables = 2^n - 2, solo aplica hasta /30
        return 0;
    }
    const hostBits = 32 - prefix;
    return Math.pow(2, hostBits) - 2;
}

/**
 * Determina la clase IP por defecto ('A', 'B', 'C', 'D', 'E') basado en el primer octeto.
 * Nota: Considera 0.x.x.x y 127.x.x.x como Clase A por definición de rango.
 * @param {string} ipString - La cadena de la dirección IPv4.
 * @returns {string|null} La clase ('A', 'B', 'C', 'D', 'E'), o null si es inválida.
 */
function getIpClass(ipString) {
    const ipInt = ipToInt(ipString);
    if (ipInt === null) return null;
    const firstOctet = (ipInt >>> 24) & 255; // Obtiene el primer octeto

    if (firstOctet >= 1 && firstOctet <= 126) return 'A'; // Rango estándar Clase A
    if (firstOctet === 127) return 'A'; // Loopback - técnicamente rango Clase A
    if (firstOctet >= 128 && firstOctet <= 191) return 'B';
    if (firstOctet >= 192 && firstOctet <= 223) return 'C';
    if (firstOctet >= 224 && firstOctet <= 239) return 'D'; // Multicast
    if (firstOctet >= 240 && firstOctet <= 255) return 'E'; // Experimental
    // Nota: El rango 0.x.x.x es especial, a menudo considerado red Clase A 0
    if (firstOctet === 0) return 'A';

    return null; // No debería alcanzarse si isValidIp funciona
}

/**
 * Obtiene la cadena de la máscara de subred por defecto para una IP dada, basada en su clase.
 * @param {string} ipString - La cadena de la dirección IPv4.
 * @returns {string|null} La máscara por defecto ("255.0.0.0", "255.255.0.0", "255.255.255.0"), o null si no es Clase A, B, o C.
 */
function getDefaultMask(ipString) {
    const ipClass = getIpClass(ipString);
    switch (ipClass) {
        case 'A': return '255.0.0.0';
        case 'B': return '255.255.0.0';
        case 'C': return '255.255.255.0';
        default: return null; // Las clases D, E no tienen máscara por defecto en este contexto
    }
}

/**
 * Calcula el número mínimo de bits de host requeridos para acomodar un número dado de hosts utilizables.
 * Fórmula: 2^bitsHost >= hostsRequeridos + 2
 * @param {number} requiredHosts - El número requerido de hosts utilizables.
 * @returns {number} El número mínimo de bits de host necesarios (0-32), o -1 si es imposible.
 */
function bitsForHosts(requiredHosts) {
    if (requiredHosts < 0 || !Number.isInteger(requiredHosts)) return -1; // Requisito inválido
    if (requiredHosts === 0) return 2; // Incluso 0 hosts utilizables necesitan red/broadcast -> min /30 -> 2 bits

    const totalAddressesNeeded = requiredHosts + 2;
    let hostBits = 0;
    // Encuentra los bitsHost más pequeños tal que 2^bitsHost >= totalAddressesNeeded
    while (Math.pow(2, hostBits) < totalAddressesNeeded) {
        hostBits++;
        if (hostBits > 32) return -1; // No se puede acomodar
    }
    // Seguridad caso especial: asegura no devolver bitsHost=0 o 1 si se necesitan más de 0 hosts
     if (requiredHosts > 0 && hostBits < 2) {
         return 2; // Mínimo 2 bits necesarios para >0 hosts utilizables
     }

    return hostBits;
}


/**
 * Calcula el número mínimo de bits de subred requeridos para crear un número dado de subredes.
 * Fórmula: 2^bitsSubred >= subredesRequeridas
 * @param {number} requiredSubnets - El número requerido de subredes.
 * @returns {number} El número mínimo de bits de subred necesarios, o -1 si es imposible.
 */
function bitsForSubnets(requiredSubnets) {
    if (requiredSubnets <= 0 || !Number.isInteger(requiredSubnets)) return -1; // Requisito inválido
    if (requiredSubnets === 1) return 0; // 1 subred requiere 0 bits extra

    let subnetBits = 0;
     // Encuentra los bitsSubred más pequeños tal que 2^bitsSubred >= subredesRequeridas
    while (Math.pow(2, subnetBits) < requiredSubnets) {
        subnetBits++;
        if (subnetBits > 32) return -1; // No se puede acomodar
    }
    return subnetBits;
}

/**
 * Calcula la dirección de red del siguiente bloque de subred adyacente.
 * Dada una red y su prefijo, encuentra la dirección de inicio del bloque inmediatamente siguiente.
 * @param {string} networkString - La cadena de la dirección de red del bloque actual.
 * @param {number} prefix - La longitud del prefijo del bloque actual.
 * @returns {string|null} La cadena de la dirección de red del siguiente bloque, o null en caso de error o desbordamiento.
 */
function getNextAvailableNetwork(networkString, prefix) {
    if (prefix < 0 || prefix > 32 || !Number.isInteger(prefix)) return null;
    const networkInt = ipToInt(networkString);
    if (networkInt === null) return null;

    // No se puede obtener la siguiente red si el prefijo es /0 (cubre todo)
    if (prefix === 0) return null;
    // Permitamos /31, la siguiente es +2. Para /32, la siguiente es +1.

    const blockSize = getTotalHosts(prefix); // Direcciones totales en el bloque
    if (blockSize === 0) return null; // No debería ocurrir para prefijo válido > /32

    // Calcula la siguiente dirección de red
    // La suma simple debería envolver correctamente gracias a >>> 0
    const nextNetworkInt = (networkInt + blockSize) >>> 0;

    // Verifica si dimos la vuelta (ej: la siguiente red es 0.0.0.0 cuando no debería serlo)
    // o si no avanzamos (caso /32 donde blockSize=1, next=net+1)
    // Una mejor verificación: si la nueva dirección es menor o igual que la anterior (y no era 0)
    if (nextNetworkInt <= networkInt && networkInt !== 0) {
        // Probablemente dimos la vuelta o agotamos el espacio
        return null; // Indica que no hay más redes disponibles
    }

    return intToIp(nextNetworkInt);
}

// ***************************************************************************************

/**
 * subnetLogic.js - Lógica principal para calcular subredes IPv4.
 * Utiliza las funciones definidas en ipUtils.js.
 * Asume que las funciones de ipUtils.js están disponibles globalmente
 * o serían importadas si se usara un sistema de módulos.
 */

/**
 * Calcula las subredes para un escenario de subneteo Classful.
 *
 * @param {string} networkIp - La dirección IP de la red a segmentar (ej: "192.168.1.0").
 * @param {object} requirement - El requisito para el subneteo.
 * @param {'subnets'|'hosts'} requirement.type - El tipo de requisito ('subnets' o 'hosts').
 * @param {number} requirement.value - El valor numérico del requisito (cantidad de subredes o hosts).
 * @returns {{success: boolean, data: object[]|null, error: string|null}} - Objeto con resultados o error.
 * data: Array de objetos, cada uno representando una subred calculada.
 */
function calculateClassful(networkIp, requirement) {
    // 1. Validar IP de entrada y determinar clase/máscara por defecto
    if (!isValidIp(networkIp)) {
        return { success: false, data: null, error: "La dirección IP de red proporcionada no es válida." };
    }

    const ipClass = getIpClass(networkIp);
    const defaultMask = getDefaultMask(networkIp);

    if (!defaultMask) {
        return { success: false, data: null, error: `La IP ${networkIp} pertenece a la Clase ${ipClass}, la cual no es directamente subnetable como A, B o C.` };
    }

    const defaultPrefix = getPrefixLength(defaultMask);
    // Asegurarse de trabajar con la dirección de red correcta
    const actualNetworkAddress = getNetworkAddress(networkIp, defaultMask);
     if (actualNetworkAddress === null) {
         // Esto no debería ocurrir si las validaciones anteriores pasaron
         return { success: false, data: null, error: "No se pudo determinar la dirección de red base." };
     }

    // 2. Validar el requisito
    if (!requirement || (requirement.type !== 'subnets' && requirement.type !== 'hosts') || typeof requirement.value !== 'number' || requirement.value <= 0 || !Number.isInteger(requirement.value)) {
        return { success: false, data: null, error: "El requisito proporcionado (tipo o valor) no es válido." };
    }

    let newPrefix;
    let neededBits;

    // 3. Calcular el nuevo prefijo basado en el requisito
    if (requirement.type === 'subnets') {
        neededBits = bitsForSubnets(requirement.value + 2);
        if (neededBits === -1) {
            return { success: false, data: null, error: `Imposible crear ${requirement.value} subredes.` };
        }
        newPrefix = defaultPrefix + neededBits;
    } else { // requirement.type === 'hosts'
        neededBits = bitsForHosts(requirement.value + 2);
         if (neededBits === -1) {
            return { success: false, data: null, error: `Imposible alojar ${requirement.value} hosts utilizables por subred.` };
        }
         // El prefijo se calcula restando los bits de host necesarios de 32
        newPrefix = 32 - neededBits;
    }

    // 4. Validar el nuevo prefijo calculado
    if (newPrefix < defaultPrefix) {
         return { success: false, data: null, error: `El requisito de ${requirement.value} ${requirement.type === 'hosts' ? 'hosts' : ''} resulta en una máscara (${getMaskStringFromPrefix(newPrefix)}) más pequeña que la máscara por defecto de la clase (${defaultMask}). Esto no es subneteo estándar.` };
    }
    if (newPrefix > 30) { // Límite estándar para tener hosts utilizables
        // Podríamos permitir /31, /32 pero advertir. Por ahora, error si se piden hosts.
        if (requirement.type === 'hosts' && requirement.value > 0) {
             return { success: false, data: null, error: `El requisito de ${requirement.value} hosts necesita un prefijo /${newPrefix}, que no permite hosts utilizables según la definición estándar.` };
        }
        // Si se pidieron subredes y resulta en > /30, podría ser válido (ej. redes p2p) pero sin hosts usables.
        // Vamos a permitirlo pero los rangos usables serán null.
         if (newPrefix > 32) {
             return { success: false, data: null, error: `El prefijo calculado /${newPrefix} es inválido.` };
         }
    }
     if (newPrefix === defaultPrefix && requirement.type === 'subnets' && requirement.value > 1) {
          return { success: false, data: null, error: `Se requiere al menos 1 bit de subred para crear más de 1 subred. No se puede subnetear con la máscara por defecto.` };
     }
      if (newPrefix === defaultPrefix && requirement.type === 'hosts') {
           const maxHostsDefault = getUsableHosts(defaultPrefix);
            if (requirement.value > maxHostsDefault) {
                return { success: false, data: null, error: `La red por defecto /${defaultPrefix} solo soporta ${maxHostsDefault} hosts utilizables. Se solicitaron ${requirement.value}.` };
            }
            // Si cabe y no se necesitan bits extra, técnicamente es una sola 'subred' (la original)
            // Devolver la red original como única subred.
      }


    const newMaskString = getMaskStringFromPrefix(newPrefix);
    if (!newMaskString) {
         return { success: false, data: null, error: "Error interno al calcular la nueva máscara de subred." };
    }

    // 5. Iterar y calcular todas las subredes generadas
    const results = [];
    let currentNetworkString = actualNetworkAddress;
    // El número de subredes generadas es 2^(bits de subred tomados)
    const subnetBitsBorrowed = newPrefix - defaultPrefix;
    const numGeneratedSubnets = Math.pow(2, subnetBitsBorrowed);

    for (let i = 0; i < numGeneratedSubnets; i++) {
        if (currentNetworkString === null) {
            // Se agotó el espacio inesperadamente (no debería pasar si la lógica es correcta)
            console.error("Error: Se agotó el espacio de direcciones inesperadamente en Classful.");
            break;
        }

        const broadcastAddress = getBroadcastAddress(currentNetworkString, newPrefix);
        const firstUsable = getFirstUsableIp(currentNetworkString, newPrefix);
        const lastUsable = getLastUsableIp(broadcastAddress, newPrefix); // broadcast es null si newPrefix > 30
        const totalHostsNum = getTotalHosts(newPrefix);
        const usableHostsNum = getUsableHosts(newPrefix);


        results.push({
            name: `Subred ${i + 1}`,
            networkAddress: currentNetworkString,
            prefix: newPrefix,
            mask: newMaskString,
            firstUsable: firstUsable,
            lastUsable: lastUsable,
            broadcastAddress: broadcastAddress,
            totalHosts: totalHostsNum,
            usableHosts: usableHostsNum,
        });

        // Calcular la siguiente dirección de red para la próxima iteración
        currentNetworkString = getNextAvailableNetwork(currentNetworkString, newPrefix);
    }

    // Si después del bucle currentNetworkString no es null, podría indicar un cálculo erróneo de numGeneratedSubnets
    // o un problema en getNextAvailableNetwork, pero lo omitimos por simplicidad ahora.

    if (results.length === 0 && newPrefix === defaultPrefix){
         // Caso especial: se pidió 1 subred o los hosts cabían en la red original
         const broadcastAddress = getBroadcastAddress(actualNetworkAddress, defaultPrefix);
         const firstUsable = getFirstUsableIp(actualNetworkAddress, defaultPrefix);
         const lastUsable = getLastUsableIp(broadcastAddress, defaultPrefix);
         const totalHostsNum = getTotalHosts(defaultPrefix);
         const usableHostsNum = getUsableHosts(defaultPrefix);
         results.push({
            name: `Red Original`,
            networkAddress: actualNetworkAddress,
            prefix: defaultPrefix,
            mask: defaultMask,
            firstUsable: firstUsable,
            lastUsable: lastUsable,
            broadcastAddress: broadcastAddress,
            totalHosts: totalHostsNum,
            usableHosts: usableHostsNum,
        });
    }

    return { success: true, data: results, error: null };
}


/**
 * Calcula las subredes para un escenario VLSM (Variable Length Subnet Mask).
 *
 * @param {string} networkIpWithPrefix - La dirección de red inicial con su prefijo (ej: "172.16.0.0/22").
 * @param {object[]} requirements - Array de objetos, cada uno con {hosts: number, name?: string}.
 * IMPORTANTE: Se espera que este array ya esté ordenado DESCENDENTEMENTE por 'hosts'.
 * @returns {{success: boolean, data: object[]|null, error: string|null}} - Objeto con resultados o error.
 * data: Array de objetos, cada uno representando una subred VLSM asignada.
 */
function calculateVLSM(networkIpWithPrefix, requirements) {
    // 1. Validar y parsear la red inicial
    const initialNetworkInfo = parseIpAndPrefix(networkIpWithPrefix);
    if (!initialNetworkInfo) {
        return { success: false, data: null, error: "La red/prefijo inicial proporcionada no es válida." };
    }
    const startNetworkInt = ipToInt(initialNetworkInfo.ip);
    const startPrefix = initialNetworkInfo.prefix;
    // Calcular el final del bloque padre para validación
    const parentBroadcastInt = ipToInt(getBroadcastAddress(initialNetworkInfo.ip, startPrefix));

     if (startNetworkInt === null || parentBroadcastInt === null) {
           return { success: false, data: null, error: "Error interno al procesar la red inicial." };
     }

    // 2. Validar requisitos (básico)
    if (!Array.isArray(requirements) || requirements.length === 0) {
        return { success: false, data: null, error: "Se requiere una lista de requisitos de hosts." };
    }
    // Clonar y validar cada requisito (asumimos que ya viene ordenado, pero podríamos re-ordenar por seguridad)
     const sortedRequirements = [...requirements]
         .filter(req => req && typeof req.hosts === 'number' && req.hosts >= 0 && Number.isInteger(req.hosts)) // Filtrar inválidos
         .sort((a, b) => b.hosts - a.hosts); // Re-ordenar por si acaso

     if (sortedRequirements.length !== requirements.length) {
         console.warn("Se filtraron algunos requisitos de VLSM inválidos.");
     }
      if (sortedRequirements.length === 0) {
           return { success: false, data: null, error: "No hay requisitos de hosts válidos para procesar." };
      }


    // 3. Iterar y asignar bloques
    const results = [];
    let currentAvailableNetworkInt = startNetworkInt;
    let currentAvailableNetworkString = initialNetworkInfo.ip; // Usamos el string para las funciones de ipUtils

    for (let i = 0; i < sortedRequirements.length; i++) {
        const req = sortedRequirements[i];
        const requiredHosts = req.hosts;
        const subnetName = req.name || `Subred ${i + 1}`;

        if (currentAvailableNetworkString === null) {
            return { success: false, data: results, error: `No hay más espacio disponible después de asignar ${i} subredes.` };
        }

        // Calcular prefijo necesario para este requisito
        const hostBitsNeeded = bitsForHosts(requiredHosts);
        if (hostBitsNeeded === -1) {
             return { success: false, data: results, error: `Imposible alojar ${requiredHosts} hosts para '${subnetName}'.` };
        }
        const requiredPrefix = 32 - hostBitsNeeded;

        // Validar si el prefijo requerido es válido y cabe en el bloque padre
        if (requiredPrefix < startPrefix) {
             return { success: false, data: results, error: `El requisito para '${subnetName}' (${requiredHosts} hosts -> /${requiredPrefix}) necesita una red más grande que el bloque inicial /${startPrefix}.` };
        }
         if (requiredPrefix > 32) { // Aunque bitsForHosts debería prevenir > /30 para hosts > 0
               return { success: false, data: results, error: `Prefijo inválido /${requiredPrefix} calculado para '${subnetName}'.` };
         }

        // Encontrar el siguiente bloque disponible que esté alineado con el requiredPrefix
        // Si la red actual no está alineada, saltar hasta la siguiente alineada.
        let alignedNetworkInt = currentAvailableNetworkInt;
        let alignedNetworkString = currentAvailableNetworkString;
        const requiredMaskInt = ipToInt(getMaskStringFromPrefix(requiredPrefix));
        if(requiredMaskInt === null) return { success: false, data: results, error: "Error interno calculando máscara requerida." };

        // Verificar alineación: network_calculada = ip_actual & mascara_requerida
        let checkAlignmentNetInt = (alignedNetworkInt & requiredMaskInt) >>> 0;
        while (checkAlignmentNetInt !== alignedNetworkInt) {
            // No está alineado. Saltar al inicio del siguiente bloque del tamaño ACTUAL disponible
            // Esto es complejo. Simplificación: Asumimos que el espacio es contiguo y
            // necesitamos encontrar el siguiente bloque TAMAÑO REQUERIDO que comience
            // en o después de currentAvailableNetworkInt.

            // Estrategia más simple: calcular el siguiente bloque del TAMAÑO REQUERIDO
            // que empieza DESPUÉS del inicio del bloque anterior (si i > 0) o en el inicio (si i=0).
            // Si currentAvailableNetworkInt no está alineado con requiredPrefix, debemos encontrar
            // el siguiente punto de alineación.
             alignedNetworkInt = ((alignedNetworkInt + getTotalHosts(requiredPrefix)) & requiredMaskInt) >>> 0; // Saltar y realinear? No, esto está mal.

             // Corrección: Si no está alineado, ¿cuál es el siguiente punto de alineación?
             // Es la dirección de red que se obtendría si forzáramos la máscara.
             const calculatedNetworkForCurrent = (currentAvailableNetworkInt & requiredMaskInt) >>> 0;
             if (calculatedNetworkForCurrent < currentAvailableNetworkInt) {
                 // El punto de alineación está antes, así que debemos saltar al *siguiente* punto de alineación
                 alignedNetworkInt = (calculatedNetworkForCurrent + getTotalHosts(requiredPrefix)) >>> 0;
             } else {
                 // El punto de alineación es donde estamos o justo adelante
                 alignedNetworkInt = calculatedNetworkForCurrent;
             }


            // Actualizar string y re-verificar alineación para el bucle
            alignedNetworkString = intToIp(alignedNetworkInt);
            checkAlignmentNetInt = (alignedNetworkInt & requiredMaskInt) >>> 0; // Recalcular con el nuevo alineado

             // ¡Importante! Verificar si el nuevo punto de alineación sigue dentro del bloque padre
             if (alignedNetworkInt > parentBroadcastInt || alignedNetworkInt < currentAvailableNetworkInt) { // < check previene wrap-around infinito
                 return { success: false, data: results, error: `No se encontró un bloque alineado para /${requiredPrefix} dentro del espacio restante para '${subnetName}'.` };
             }
        }
        // Ahora alignedNetworkInt/String está alineado para el requiredPrefix


        // Calcular el broadcast de este bloque potencial
        const potentialBroadcastInt = ipToInt(getBroadcastAddress(alignedNetworkString, requiredPrefix));
        if(potentialBroadcastInt === null) return { success: false, data: results, error: "Error interno calculando broadcast potencial." };


        // Verificar si este bloque cabe DENTRO del bloque padre
        if (alignedNetworkInt < currentAvailableNetworkInt || // No deberia pasar con la corrección de alineación
            alignedNetworkInt > parentBroadcastInt ||
            potentialBroadcastInt > parentBroadcastInt)
        {
            return { success: false, data: results, error: `Espacio insuficiente para asignar /${requiredPrefix} para '${subnetName}'. El bloque se saldría de la red padre /${startPrefix}.` };
        }

        // ¡Asignación exitosa! Calcular detalles
        const assignedMaskString = getMaskStringFromPrefix(requiredPrefix);
        const assignedBroadcastString = intToIp(potentialBroadcastInt);
        const firstUsable = getFirstUsableIp(alignedNetworkString, requiredPrefix);
        const lastUsable = getLastUsableIp(assignedBroadcastString, requiredPrefix);
        const totalHostsNum = getTotalHosts(requiredPrefix);
        const usableHostsNum = getUsableHosts(requiredPrefix);

        results.push({
            name: subnetName,
            networkAddress: alignedNetworkString,
            prefix: requiredPrefix,
            mask: assignedMaskString,
            firstUsable: firstUsable,
            lastUsable: lastUsable,
            broadcastAddress: assignedBroadcastString,
            requestedHosts: requiredHosts, // Guardar lo que se pidió
            usableHosts: usableHostsNum,    // Guardar lo que realmente se obtiene
            totalHosts: totalHostsNum,
        });

        // Actualizar el puntero a la siguiente dirección disponible
        // Es la dirección inmediatamente después del broadcast de la red recién asignada.
        currentAvailableNetworkInt = (potentialBroadcastInt + 1) >>> 0;
        currentAvailableNetworkString = intToIp(currentAvailableNetworkInt);

        // Verificar si la siguiente disponible se salió del bloque padre
         if (currentAvailableNetworkInt > parentBroadcastInt && i < sortedRequirements.length - 1) {
             // Se asignó la última parte, pero aún quedan requisitos
              return { success: false, data: results, error: `Se asignó espacio para '${subnetName}', pero no queda espacio para requisitos posteriores.` };
         }
          if (currentAvailableNetworkInt === 0 && potentialBroadcastInt !== ipToInt("255.255.255.255")) {
               // Si la siguiente es 0.0.0.0 pero no venimos de asignar hasta el final, hubo wrap-around.
                return { success: false, data: results, error: `Se detectó desbordamiento de espacio de direcciones después de asignar '${subnetName}'.` };
          }


    } // Fin del bucle for requirements

    return { success: true, data: results, error: null };
}


// *******************************************************************************************

/**
 * exerciseGenerator.js - Lógica para generar ejercicios de subneteo aleatorios.
 * Utiliza las funciones de ipUtils.js y subnetLogic.js (deben estar cargadas previamente).
 * La lógica Classful asume la perspectiva histórica (subnet zero/all-ones no usables).
 */

/**
 * Genera un número entero aleatorio dentro de un rango [min, max] (ambos inclusive).
 * @param {number} min - El valor mínimo.
 * @param {number} max - El valor máximo.
 * @returns {number} Un entero aleatorio dentro del rango.
 */
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    if (min > max) { [min, max] = [max, min]; }
    if (min === max) { return min; }
    if (max < min) max = min; // Asegurar que max es al menos min
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Genera un problema de subneteo Classful aleatorio bajo la perspectiva histórica.
 * - Si se pide por hosts, asegura que resulten al menos 4 subredes totales.
 * - Si se pide por subredes (N), calcula para N+2 subredes totales.
 * - Limita el número MÁXIMO de subredes utilizables resultantes a ~25.
 *
 * @param {string} difficulty - Nivel de dificultad ('easy', 'medium', 'hard'). No implementado.
 * @returns {{problemStatement: string, problemData: object, solution: object[]}|null} - Objeto con el problema y la solución, o null si falla.
 */
function generateClassfulProblem(difficulty = 'medium') {
    let attempts = 0;
    const maxAttempts = 30; // Más intentos por validaciones estrictas
    const maxUsableResultingSubnets = 25; // Límite de subredes UTILIZABLES que queremos generar

    while (attempts < maxAttempts) {
        attempts++;
        let baseIp = '';
        let ipClass = '';
        let defaultPrefix = 0;
        const maxAllowedPrefix = 30; // Límite para tener hosts usables estándar

        // 1. Generar Red Base Aleatoria (Privada)
        const classChoice = getRandomInt(1, 3);
        if (classChoice === 1) { ipClass = 'C'; defaultPrefix = 24; baseIp = `192.168.${getRandomInt(0, 255)}.${getRandomInt(1, 254)}`; }
        else if (classChoice === 2) { ipClass = 'B'; defaultPrefix = 16; baseIp = `172.${getRandomInt(16, 31)}.${getRandomInt(0, 255)}.${getRandomInt(1, 254)}`; }
        else { ipClass = 'A'; defaultPrefix = 8; baseIp = `10.${getRandomInt(0, 255)}.${getRandomInt(0, 255)}.${getRandomInt(1, 254)}`; }
        const defaultMask = getDefaultMask(baseIp);
        if (!defaultMask) continue;
        const networkAddress = getNetworkAddress(baseIp, defaultMask);
        if (!networkAddress) continue;

        // 2. Generar Requisito Aleatorio (Subredes o Hosts)
        const requirementType = Math.random() < 0.5 ? 'subnets' : 'hosts';
        let requirementValue = 0;
        let resultingPrefix; // Prefijo que resultará del requisito
        let subnetBitsBorrowed; // Bits que se tomarán prestados
        let numGeneratedSubnets; // Subredes totales que se generarán

        if (requirementType === 'subnets') {
            // --- Requisito por Subredes (UTILIZABLES) ---
            const availableSubnetBits = maxAllowedPrefix - defaultPrefix;
            // Necesitamos al menos 2 bits prestados para tener >= 2 subredes utilizables (4 totales)
            if (availableSubnetBits < 2) continue;

            // Calcular bits máx para no exceder el límite de usables (~25)
            // Max total = 25 usables + 2 = 27 -> bitsForSubnets(27) = 5
            const neededBitsForMaxUsable = bitsForSubnets(maxUsableResultingSubnets + 2); // = 5
            const maxBitsToBorrow = Math.min(availableSubnetBits, neededBitsForMaxUsable);

            // Elegir bits a tomar prestados (entre 2 y el máximo)
            subnetBitsToUse = getRandomInt(2, maxBitsToBorrow);
            resultingPrefix = defaultPrefix + subnetBitsToUse;
            numGeneratedSubnets = Math.pow(2, subnetBitsToUse);
            const maxUsableSubnetsPossible = numGeneratedSubnets - 2;

            // Generar el valor del requisito (subredes UTILIZABLES a pedir)
            // Pedir entre 2 y el máximo de usables posible con esos bits
            const minUsableSubnetsToRequest = 2;
            if (maxUsableSubnetsPossible < minUsableSubnetsToRequest) continue; // Si no podemos ni pedir 2 usables
            requirementValue = getRandomInt(minUsableSubnetsToRequest, maxUsableSubnetsPossible);
            subnetBitsBorrowed = subnetBitsToUse; // Guardar los bits usados

        } else { // requirementType === 'hosts'
            // --- Requisito por Hosts Utilizables ---
            const availableHostBits = 32 - defaultPrefix;
            // Necesitamos dejar al menos 2 bits para hosts (/30) y tomar prestados al menos 2 bits para subredes (>=4 totales)
            if (availableHostBits <= 3) continue; // No hay espacio para >=2 bits de subred y >=2 bits de host

            // Elegir bits de host a dejar (entre 2 y availableHostBits - 2)
            const hostBitsToUse = getRandomInt(2, availableHostBits - 2);
            resultingPrefix = 32 - hostBitsToUse;
            subnetBitsBorrowed = resultingPrefix - defaultPrefix; // Bits que se tomaron
            numGeneratedSubnets = Math.pow(2, subnetBitsBorrowed);

            // Validar que se generen al menos 4 subredes totales
            if (numGeneratedSubnets < 4) {
                // console.log(`Classful Gen Attempt ${attempts}: Req hosts -> ${hostBitsToUse} bits host -> ${numGeneratedSubnets} subredes totales (<4).`);
                continue;
            }
             // Validar que no exceda el límite de usables
             if ((numGeneratedSubnets - 2) > maxUsableResultingSubnets) {
                 // console.log(`Classful Gen Attempt ${attempts}: Req hosts -> ${numGeneratedSubnets} subredes totales -> ${numGeneratedSubnets-2} usables (> ${maxUsableResultingSubnets}).`);
                 continue;
             }

            // Calcular hosts usables para este tamaño de bloque
            const maxHostsForBits = getUsableHosts(resultingPrefix);
            if (maxHostsForBits < 2) continue; // Seguridad

            // Pedir entre 2 y el máximo de hosts usables
            requirementValue = getRandomInt(2, maxHostsForBits);
        }

        // Verificar requisito y prefijo finales
        if (requirementValue <= 0 || resultingPrefix < defaultPrefix || resultingPrefix > 30) continue;

        // Crear objeto del problema
        const problem = {
            network: networkAddress,
            requirement: {
                type: requirementType,
                value: requirementValue
            }
        };

        // 3. Calcular Solución y Validar
        // La función calculateClassful ya genera TODAS las subredes (incluyendo zero/all-ones)
        const calculationResult = calculateClassful(problem.network, problem.requirement);

        // Validar si el cálculo fue exitoso y generó el número esperado de subredes TOTALES
        if (calculationResult.success && calculationResult.data && calculationResult.data.length > 0) {
             const expectedNumSubnets = (subnetBitsBorrowed === 0) ? 1 : numGeneratedSubnets;
             if (calculationResult.data.length !== expectedNumSubnets) {
                 console.warn(`Classful Gen: Discrepancia - Esperadas Totales: ${expectedNumSubnets}, Solución tiene: ${calculationResult.data.length}`);
                 continue; // Algo falló en el cálculo, reintentar
             }

            // Formatear el problema para el usuario
            let problemText = `Subnetea la red ${problem.network} (Clase ${ipClass}, máscara por defecto ${defaultMask}) `;
            if(problem.requirement.type === 'subnets') {
                // Indicar que se piden subredes UTILIZABLES
                problemText += `para obtener al menos ${problem.requirement.value} subredes utilizables (asumiendo que subnet zero y all-ones no se usan para hosts).`;
            } else {
                 problemText += `de forma que cada subred pueda alojar al menos ${problem.requirement.value} hosts utilizables (asumiendo que subnet zero y all-ones no se usan para hosts).`;
            }

            return {
                problemStatement: problemText,
                problemData: problem, // Datos crudos para validación interna
                solution: calculationResult.data // La solución contiene TODAS las subredes generadas
            };
        }
        // Si falló el cálculo, registrar (opcional) y continuar el bucle while
        // console.log(`Intento ${attempts} fallido para Classful (Histórico): ${calculationResult.error || 'Resultado vacío'}`);

    } // fin while

    console.error("GENERATOR: No se pudo generar un problema Classful (Histórico) válido después de varios intentos.");
    return null; // Falló la generación
}


// --- La función generateVLSMProblem permanece igual que en la v3 ---
function generateVLSMProblem(difficulty = 'medium') {
    let attempts = 0;
    const maxAttempts = 25;

    while (attempts < maxAttempts) {
        attempts++;
        const startPrefix = getRandomInt(16, 26);
        let baseIp = '';
        const classChoice = getRandomInt(1, 3);
        if (classChoice === 1) { baseIp = `192.168.${getRandomInt(0, 255)}.${getRandomInt(1, 254)}`; }
        else if (classChoice === 2) { baseIp = `172.${getRandomInt(16, 31)}.${getRandomInt(0, 255)}.${getRandomInt(1, 254)}`; }
        else { baseIp = `10.${getRandomInt(0, 255)}.${getRandomInt(0, 255)}.${getRandomInt(1, 254)}`; }
        const networkAddress = getNetworkAddress(baseIp, startPrefix);
        if (!networkAddress) continue;
        const startCIDR = `${networkAddress}/${startPrefix}`;
        const totalAvailableAddresses = getTotalHosts(startPrefix);
        const numRequirements = getRandomInt(2, 5);
        const maxHostsToRequestPerReq = 1000;
        const requirements = [];
        let totalAddressesNeededHeuristic = 0;
        for (let i = 0; i < numRequirements; i++) {
            const maxHostBitsAvailable = 32 - startPrefix;
            if (maxHostBitsAvailable < 2) break;
            const hostBitsForReq = getRandomInt(2, maxHostBitsAvailable - getRandomInt(0, Math.min(maxHostBitsAvailable - 2, 4)));
            const usableHostsForBlock = getUsableHosts(32 - hostBitsForReq);
            if (usableHostsForBlock < 2) continue;
            const actualMaxHostsForReq = Math.min(usableHostsForBlock, maxHostsToRequestPerReq);
            if (actualMaxHostsForReq < 2) continue;
            const requiredHosts = getRandomInt(2, actualMaxHostsForReq);
            const hostBitsActuallyNeeded = bitsForHosts(requiredHosts);
            if (hostBitsActuallyNeeded === -1 || hostBitsActuallyNeeded > maxHostBitsAvailable) continue;
            const blockSizeForReq = Math.pow(2, hostBitsActuallyNeeded);
            totalAddressesNeededHeuristic += blockSizeForReq;
            requirements.push({ hosts: requiredHosts, name: `Red ${String.fromCharCode(65 + i)}` });
        }
        if (requirements.length < Math.min(numRequirements, 2)) continue;
        if (totalAddressesNeededHeuristic > totalAvailableAddresses) continue;
        requirements.sort((a, b) => b.hosts - a.hosts);
        const problem = { network: startCIDR, requirements: requirements };
        const calculationResult = calculateVLSM(problem.network, problem.requirements);
        if (calculationResult.success && calculationResult.data && calculationResult.data.length === requirements.length) {
             let problemText = `Subnetea en modo VLSM el bloque ${problem.network} para satisfacer los siguientes requisitos de hosts (ordenados de mayor a menor):\n`;
             problem.requirements.forEach(req => { problemText += ` - ${req.name}: ${req.hosts} hosts\n`; });
            return { problemStatement: problemText.trim(), problemData: problem, solution: calculationResult.data };
        }
    }
    console.error("GENERATOR: No se pudo generar un problema VLSM válido después de varios intentos.");
    return null;
}

// ****************************************************************************************

/**
 * uiController.js - Controlador de la interfaz de usuario para la Herramienta de Subneteo.
 * Maneja eventos, interactúa con la lógica (subnetLogic, exerciseGenerator) y actualiza el DOM.
 * Asume que ipUtils.js, subnetLogic.js, y exerciseGenerator.js están cargados previamente.
 */

// Espera a que todo el contenido del DOM esté cargado antes de ejecutar el script
document.addEventListener('DOMContentLoaded', () => {

    // --- REFERENCIAS A ELEMENTOS DEL DOM ---
    // (Se mantienen las referencias anteriores)
    const btnCalculatorMode = document.getElementById('btnCalculatorMode');
    const btnExerciseMode = document.getElementById('btnExerciseMode');
    const calculatorModeSection = document.getElementById('calculatorMode');
    const exerciseModeSection = document.getElementById('exerciseMode');
    const calcTypeRadios = document.querySelectorAll('input[name="calcType"]');
    const classfulForm = document.getElementById('classfulForm');
    const vlsmForm = document.getElementById('vlsmForm');
    const classfulNetworkIpInput = document.getElementById('classfulNetworkIp');
    const classfulIpInfoSpan = classfulForm.querySelector('.ip-info');
    const classfulReqTypeRadios = document.querySelectorAll('input[name="classfulRequirement"]');
    const numSubnetsInput = document.getElementById('numSubnets');
    const numHostsInput = document.getElementById('numHosts');
    const vlsmNetworkIpInput = document.getElementById('vlsmNetworkIp');
    const vlsmRequirementsContainer = document.getElementById('vlsmRequirements');
    const addVlsmRequirementBtn = document.getElementById('addVlsmRequirement');
    const calculatorResultsDiv = document.getElementById('calculatorResults');
    const calcSummaryDiv = document.getElementById('calcSummary');
    const calcTableContainer = document.getElementById('calcTableContainer');
    const exerciseTypeSelect = document.getElementById('exerciseType');
    const generateExerciseBtn = document.getElementById('generateExercise');
    const exercisePromptDiv = document.getElementById('exercisePrompt');
    const exerciseSolutionInputDiv = document.getElementById('exerciseSolutionInput');
    const userAnswerTableContainer = document.getElementById('userAnswerTableContainer');
    const checkAnswerBtn = document.getElementById('checkAnswer');
    const exerciseFeedbackDiv = document.getElementById('exerciseFeedback');
    const exerciseFeedbackParagraph = exerciseFeedbackDiv.querySelector('p');
    const exerciseSolutionDiv = document.getElementById('exerciseSolution');
    const solutionTableContainer = document.getElementById('solutionTableContainer');
    const showSolutionBtn = document.getElementById('showSolutionBtn');
    const explanationControlsDiv = document.querySelector('.explanation-controls');
    const exerciseExplanationMethodSelect = document.getElementById('exerciseExplanationMethod');
    const showSolutionStepsBtn = document.getElementById('showSolutionSteps');
    const solutionStepsContentDiv = document.getElementById('solutionStepsContent');
    const yearSpan = document.getElementById('year');

    // --- NUEVAS REFERENCIAS ---
    const resetClassfulBtn = document.getElementById('resetClassfulBtn');
    const resetVlsmBtn = document.getElementById('resetVlsmBtn');


    // --- ESTADO INTERNO ---
    let currentExerciseData = null; // Almacenará { problemData, solution }

    // --- FUNCIONES AUXILIARES DE UI ---

    /** Actualiza el año en el footer */
    function updateFooterYear() {
        const currentYear = new Date().getFullYear();
        if(yearSpan) yearSpan.textContent = currentYear;
    }

    /** Cambia la visibilidad de las secciones de modo y actualiza botones */
    function switchMode(modeToShow) {
        if (modeToShow === 'calculator') {
            calculatorModeSection.classList.add('active');
            exerciseModeSection.classList.remove('active');
            btnCalculatorMode.classList.add('active');
            btnExerciseMode.classList.remove('active');
        } else if (modeToShow === 'exercise') {
            calculatorModeSection.classList.remove('active');
            exerciseModeSection.classList.add('active');
            btnCalculatorMode.classList.remove('active');
            btnExerciseMode.classList.add('active');
        }
        clearCalculatorResults();
        clearExerciseArea();
    }

     /** Cambia entre los formularios de Classful y VLSM dentro del modo Calculadora */
    function switchCalculatorForm(formToShow) {
        if (formToShow === 'classful') {
            classfulForm.classList.add('active');
            vlsmForm.classList.remove('active');
        } else if (formToShow === 'vlsm') {
            classfulForm.classList.remove('active');
            vlsmForm.classList.add('active');
        }
        clearCalculatorResults(); // Limpiar resultados al cambiar tipo
        // Limpiar también los formularios al cambiar
        resetClassfulFormInputs();
        resetVlsmFormInputs();
    }

    /** Limpia el área de resultados de la calculadora */
    function clearCalculatorResults() {
        if(calcSummaryDiv) calcSummaryDiv.innerHTML = '';
        if(calcTableContainer) calcTableContainer.innerHTML = '<p>Introduce los datos y haz clic en calcular.</p>';
        if(calcTableContainer) clearError(calcTableContainer); // Limpiar errores del área de resultados
    }

    /** Limpia específicamente los inputs del formulario Classful */
    function resetClassfulFormInputs() {
        if (classfulForm) classfulForm.reset(); // Método reset nativo para formularios
        if (classfulNetworkIpInput) clearError(classfulNetworkIpInput);
        if (classfulIpInfoSpan) classfulIpInfoSpan.textContent = '';
        // Asegurar que el radio 'subnets' esté seleccionado por defecto
        const reqSubnetsRadio = document.getElementById('reqSubnets');
        if (reqSubnetsRadio) reqSubnetsRadio.checked = true;
    }

    /** Limpia específicamente los inputs del formulario VLSM */
    function resetVlsmFormInputs() {
        if (vlsmForm) vlsmForm.reset(); // Limpia inputs básicos como la IP
        if (vlsmNetworkIpInput) clearError(vlsmNetworkIpInput);
        // Eliminar todas las filas de requisitos excepto la primera
        if (vlsmRequirementsContainer) {
            const requirementRows = vlsmRequirementsContainer.querySelectorAll('.vlsm-requirement');
            // Empezar desde el final para evitar problemas con índices cambiantes
            for (let i = requirementRows.length - 1; i > 0; i--) {
                requirementRows[i].remove();
            }
            // Limpiar la primera fila que queda
            const firstRow = vlsmRequirementsContainer.querySelector('.vlsm-requirement');
            if (firstRow) {
                firstRow.querySelector('input[type="number"]').value = '';
                firstRow.querySelector('input[type="text"]').value = '';
            }
        }
    }

    /** Limpia toda el área de ejercicios */
     function clearExerciseArea() {
        if(exercisePromptDiv) exercisePromptDiv.innerHTML = '<h3>Problema:</h3><p>Haz clic en "Generar Nuevo Ejercicio".</p>';
        if(exerciseSolutionInputDiv) exerciseSolutionInputDiv.style.display = 'none';
        if(userAnswerTableContainer) userAnswerTableContainer.innerHTML = '';
        if(exerciseFeedbackDiv) exerciseFeedbackDiv.style.display = 'none';
        if(exerciseFeedbackParagraph) exerciseFeedbackParagraph.textContent = '';
        if(exerciseFeedbackDiv) exerciseFeedbackDiv.classList.remove('correct', 'incorrect');
        if(exerciseSolutionDiv) exerciseSolutionDiv.style.display = 'none';
        if(solutionTableContainer) solutionTableContainer.innerHTML = '';
        if(solutionStepsContentDiv) solutionStepsContentDiv.innerHTML = '';
        if(solutionStepsContentDiv) solutionStepsContentDiv.style.display = 'none';
        if(showSolutionBtn) showSolutionBtn.style.display = 'none';
        if(explanationControlsDiv) explanationControlsDiv.style.display = 'none';
        currentExerciseData = null;
    }

    /** Añade una nueva fila para requisitos VLSM con los estilos de Bootstrap correctos */
    function addVlsmRequirementRow() {
        const reqDiv = document.createElement('div');
        // [CORRECCIÓN] Añadimos las clases de Bootstrap que faltaban para el layout y estilo
        reqDiv.classList.add('vlsm-requirement', 'input-group', 'mb-2');
    
        // [CORRECCIÓN] Añadimos las clases a los inputs y al botón
        reqDiv.innerHTML = `
            <input type="number" class="form-control" min="1" placeholder="Nº de Hosts" required>
            <input type="text" class="form-control" placeholder="Nombre de Red (Opcional)">
            <button type="button" class="btn btn-outline-danger remove-req">-</button>
        `;
        
        // El 'if' que tenías para añadirlo al contenedor está dentro del uiController,
        // pero si lo estás modificando directamente en subnetting-tool.js, esta es la lógica completa.
        const vlsmRequirementsContainer = document.getElementById('vlsmRequirements');
        if(vlsmRequirementsContainer) {
            vlsmRequirementsContainer.appendChild(reqDiv);
        }
    }

    /** Elimina una fila de requisito VLSM */
    function removeVlsmRequirementRow(buttonElement) {
        const rowToRemove = buttonElement.closest('.vlsm-requirement');
        if (vlsmRequirementsContainer && vlsmRequirementsContainer.querySelectorAll('.vlsm-requirement').length > 1) {
            rowToRemove.remove();
        } else {
            alert("Debe haber al menos un requisito.");
        }
    }

    /** Muestra un mensaje de error */
    function displayError(target, message) {
        let errorElement;
        const targetElement = (typeof target === 'string') ? document.querySelector(target) : target;
        if (!targetElement) return;
        let errorContainerId = `error-for-${targetElement.id || targetElement.classList[0] || 'element'}`;
         errorElement = document.getElementById(errorContainerId);
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.id = errorContainerId;
            errorElement.classList.add('error-message');
            errorElement.style.color = 'red'; errorElement.style.fontSize = '0.9em'; errorElement.style.marginTop = '5px';
            if (targetElement.parentNode && targetElement.nextSibling) { targetElement.parentNode.insertBefore(errorElement, targetElement.nextSibling); }
            else if (targetElement.parentNode){ targetElement.parentNode.appendChild(errorElement); }
            else { targetElement.appendChild(errorElement); }
        }
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }

    /** Limpia mensajes de error */
    function clearError(target) {
         const targetElement = (typeof target === 'string') ? document.querySelector(target) : target;
         if (!targetElement) return;
         let errorContainerId = `error-for-${targetElement.id || targetElement.classList[0] || 'element'}`;
         const errorElement = document.getElementById(errorContainerId);
          if (errorElement) { errorElement.textContent = ''; errorElement.style.display = 'none'; }
    }

    /** Muestra resultados de la calculadora */
    function displayCalculatorResults(result) {
        // (Sin cambios en esta función)
        clearCalculatorResults();
        if (!result.success) { displayError(calcTableContainer, `Error: ${result.error}`); return; }
        if (!result.data || result.data.length === 0) { calcTableContainer.innerHTML = '<p>No se generaron subredes...</p>'; return; }
        const data = result.data;
        const isClassfulResult = data.length > 0 && data[0].requestedHosts === undefined;
        let summaryHTML = `Cálculo completado. Se generaron ${data.length} subred(es).`;
        if (isClassfulResult) {
            const commonMask = data[0].mask; const commonPrefix = data[0].prefix;
            const commonTotalHosts = data[0].totalHosts.toLocaleString(); const commonUsableHosts = data[0].usableHosts.toLocaleString();
            summaryHTML += `<br><span class="common-info">Máscara común: ${commonMask} (/${commonPrefix}) | Hosts Usables p/Subred: ${commonUsableHosts} (Total: ${commonTotalHosts})</span>`;
            if (data.length > 1) { summaryHTML += `<br><small style='color: #6c757d;'><i>Las filas resaltadas representan 'Subnet Zero' y 'All-Ones Subnet'...</i></small>`; }
        }
        calcSummaryDiv.innerHTML = summaryHTML;
        let tableHTML = `<table><thead><tr><th>Nombre</th><th>Dir. Red</th>${isClassfulResult ? '' : '<th>Máscara</th><th>Prefijo</th>'}<th>Rango Usable</th><th>Broadcast</th>${isClassfulResult ? '' : '<th>Hosts Totales</th><th>Hosts Usables</th>'}${!isClassfulResult ? '<th>Hosts Pedidos</th>' : ''}</tr></thead><tbody>`;
        data.forEach((subnet, index) => {
            let rowClass = ''; let nameSuffix = '';
            if (isClassfulResult && data.length > 1) {
                 if (index === 0) { rowClass = ' class="subnet-zero-or-all-ones"'; nameSuffix = ' <span class="subnet-label">(Subnet Zero)</span>'; }
                 else if (index === data.length - 1) { rowClass = ' class="subnet-zero-or-all-ones"'; nameSuffix = ' <span class="subnet-label">(All-Ones)</span>'; }
            }
            tableHTML += `<tr${rowClass}><td>${subnet.name || '-'}${nameSuffix}</td><td>${subnet.networkAddress}</td>${isClassfulResult ? '' : `<td>${subnet.mask}</td><td>/${subnet.prefix}</td>`}<td>${subnet.firstUsable ? `${subnet.firstUsable} - ${subnet.lastUsable}` : 'N/A'}</td><td>${subnet.broadcastAddress}</td>${isClassfulResult ? '' : `<td style="text-align: right;">${subnet.totalHosts.toLocaleString()}</td><td style="text-align: right;">${subnet.usableHosts.toLocaleString()}</td>`}${!isClassfulResult ? `<td style="text-align: right;">${subnet.requestedHosts.toLocaleString()}</td>` : ''}</tr>`;
        });
        tableHTML += `</tbody></table>`;
        calcTableContainer.innerHTML = tableHTML;
    }

    /** Muestra el problema del ejercicio */
    function displayExercise(exerciseData) {
        // (Sin cambios en esta función)
        clearExerciseArea();
        if (!exerciseData || !exerciseData.problemStatement || !exerciseData.solution) {
            exercisePromptDiv.innerHTML = '<h3>Problema:</h3><p>Error al generar el ejercicio...</p>'; return;
        }
        currentExerciseData = exerciseData;
        exercisePromptDiv.innerHTML = `<h3>Problema:</h3><p>${exerciseData.problemStatement.replace(/\n/g, '<br>')}</p>`;
        generateUserInputTable(currentExerciseData.solution);
        exerciseSolutionInputDiv.style.display = 'block';
        checkAnswerBtn.style.display = 'inline-block';
    }

    /** Genera tabla de entrada para el usuario */
    function generateUserInputTable(correctSolution) {
        // (Sin cambios en esta función)
        if (!correctSolution || correctSolution.length === 0) { userAnswerTableContainer.innerHTML = '<p>Error: Solución no válida.</p>'; return; }
        let tableHTML = `<table><thead><tr><th>Nombre</th><th>Dir. Red</th><th>Máscara / Prefijo</th><th>Primer Host Usable</th><th>Último Host Usable</th><th>Broadcast</th></tr></thead><tbody>`;
        correctSolution.forEach((subnet, index) => {
            const name = subnet.name || `Subred ${index + 1}`;
            tableHTML += `<tr><td>${name}</td><td><input type="text" data-field="networkAddress" data-index="${index}" placeholder="Ej: 192.168.1.0"></td><td><input type="text" data-field="maskOrPrefix" data-index="${index}" placeholder="Ej: /24"></td><td><input type="text" data-field="firstUsable" data-index="${index}" placeholder="Ej: 192.168.1.1"></td><td><input type="text" data-field="lastUsable" data-index="${index}" placeholder="Ej: 192.168.1.254"></td><td><input type="text" data-field="broadcastAddress" data-index="${index}" placeholder="Ej: 192.168.1.255"></td></tr>`;
        });
        tableHTML += `</tbody></table>`;
        userAnswerTableContainer.innerHTML = tableHTML;
    }

    /** Obtiene respuestas del usuario */
    function getUserAnswers() {
        // (Sin cambios en esta función)
        const userAnswers = [];
        const rows = userAnswerTableContainer.querySelectorAll('tbody tr');
        rows.forEach((row, index) => {
            const inputs = row.querySelectorAll('input[data-field]');
            const answer = { index: index };
            inputs.forEach(input => { answer[input.dataset.field] = input.value.trim(); });
            userAnswers.push(answer);
        });
        return userAnswers;
    }

    /** Compara respuestas */
    function compareAnswers(userAnswers, correctSolution) {
        // (Sin cambios en esta función)
        let isFullyCorrect = true; let feedback = ''; const errors = [];
        if (!correctSolution || userAnswers.length !== correctSolution.length) { return { correct: false, feedback: 'Error: El número de respuestas no coincide.', errors: [] }; }
        for (let i = 0; i < correctSolution.length; i++) {
            const user = userAnswers[i]; const correct = correctSolution[i]; let rowErrors = {};
            if (user.networkAddress !== correct.networkAddress) { isFullyCorrect = false; rowErrors.networkAddress = `Esperado: ${correct.networkAddress}`; }
            let userPrefix = null;
            if (user.maskOrPrefix.startsWith('/')) { userPrefix = parseInt(user.maskOrPrefix.substring(1), 10); }
            else if (isValidMask(user.maskOrPrefix)) { userPrefix = getPrefixLength(user.maskOrPrefix); }
            if (userPrefix === null || userPrefix !== correct.prefix) { isFullyCorrect = false; rowErrors.maskOrPrefix = `Esperado: /${correct.prefix} (${correct.mask})`; }
            const expectedFirst = correct.firstUsable || 'N/A'; if(user.firstUsable !== expectedFirst) { isFullyCorrect = false; rowErrors.firstUsable = `Esperado: ${expectedFirst}`; }
            const expectedLast = correct.lastUsable || 'N/A'; if(user.lastUsable !== expectedLast) { isFullyCorrect = false; rowErrors.lastUsable = `Esperado: ${expectedLast}`; }
            if (user.broadcastAddress !== correct.broadcastAddress) { isFullyCorrect = false; rowErrors.broadcastAddress = `Esperado: ${correct.broadcastAddress}`; }
            if (Object.keys(rowErrors).length > 0) { errors.push({ index: i, fields: rowErrors, name: correct.name || `Subred ${i+1}` }); }
        }
        if (isFullyCorrect) { feedback = '¡Todas las respuestas son correctas! ¡Excelente trabajo!'; }
        else { feedback = `Se encontraron errores. Revisa los campos marcados o haz clic en "Mostrar Solución". Errores en ${errors.length} subred(es).`; }
        return { correct: isFullyCorrect, feedback: feedback, errors: errors };
    }

    /** Muestra feedback y botón de solución */
    function displayFeedback(comparisonResult) {
        // (Sin cambios en esta función)
        if (!exerciseFeedbackParagraph || !exerciseFeedbackDiv || !showSolutionBtn || !exerciseSolutionDiv || !solutionStepsContentDiv || !explanationControlsDiv) {
            console.error("Error: Faltan elementos de UI para mostrar feedback/solución.");
            return;
        }
        exerciseFeedbackParagraph.textContent = comparisonResult.feedback;
        exerciseFeedbackDiv.classList.remove('correct', 'incorrect');
        if (comparisonResult.correct) { exerciseFeedbackDiv.classList.add('correct'); }
        else { exerciseFeedbackDiv.classList.add('incorrect'); highlightErrors(comparisonResult.errors); }
        exerciseFeedbackDiv.style.display = 'block';
        showSolutionBtn.style.display = 'inline-block';
        exerciseSolutionDiv.style.display = 'none';
        solutionStepsContentDiv.style.display = 'none';
        explanationControlsDiv.style.display = 'none';
    }

    /** Resalta errores en inputs */
    function highlightErrors(errors) {
        // (Sin cambios en esta función)
        if(!userAnswerTableContainer) return;
        userAnswerTableContainer.querySelectorAll('input').forEach(input => input.style.borderColor = '#ccc');
        errors.forEach(errorDetail => {
            const row = userAnswerTableContainer.querySelectorAll('tbody tr')[errorDetail.index];
            if (row) {
                 for (const fieldName in errorDetail.fields) {
                     const input = row.querySelector(`input[data-field="${fieldName}"]`);
                      if (input) { input.style.borderColor = 'red'; }
                 }
            }
        });
    }

    /** Muestra tabla de solución y controles de explicación */
    function displaySolution(correctSolution) {
        // (Sin cambios en esta función)
        if (!correctSolution) { solutionTableContainer.innerHTML = '<p>No hay solución disponible.</p>'; return; }
        if (!solutionTableContainer || !exerciseSolutionDiv || !explanationControlsDiv) {
             console.error("Error: Faltan elementos de UI para mostrar la solución.");
             return;
        }
        const resultObject = { success: true, data: correctSolution };
        const isClassfulResult = correctSolution.length > 0 && correctSolution[0].requestedHosts === undefined;
        let tableHTML = '';
        if (!resultObject.data || resultObject.data.length === 0) { tableHTML = '<p>No se generaron subredes.</p>'; }
        else {
            const data = resultObject.data;
            tableHTML = `<h4>Tabla de Solución Correcta:</h4><table><thead><tr><th>Nombre</th><th>Dir. Red</th>${isClassfulResult ? '' : '<th>Máscara</th><th>Prefijo</th>'}<th>Rango Usable</th><th>Broadcast</th>${isClassfulResult ? '' : '<th>Hosts Totales</th><th>Hosts Usables</th>'}${!isClassfulResult ? '<th>Hosts Pedidos</th>' : ''}</tr></thead><tbody>`;
            data.forEach(subnet => {
                tableHTML += `<tr><td>${subnet.name || '-'}</td><td>${subnet.networkAddress}</td>${isClassfulResult ? '' : `<td>${subnet.mask}</td><td>/${subnet.prefix}</td>`}<td>${subnet.firstUsable ? `${subnet.firstUsable} - ${subnet.lastUsable}` : 'N/A'}</td><td>${subnet.broadcastAddress}</td>${isClassfulResult ? '' : `<td style="text-align: right;">${subnet.totalHosts.toLocaleString()}</td><td style="text-align: right;">${subnet.usableHosts.toLocaleString()}</td>`}${!isClassfulResult ? `<td style="text-align: right;">${subnet.requestedHosts.toLocaleString()}</td>` : ''}</tr>`;
            });
            tableHTML += `</tbody></table>`;
        }
        solutionTableContainer.innerHTML = tableHTML;
        exerciseSolutionDiv.style.display = 'block';
        explanationControlsDiv.style.display = 'flex';
    }

    /**
     * Genera el HTML con los pasos de la explicación para un ejercicio de subneteo.
     * (Incluye la lógica corregida para Classful Magic Number)
     * @param {object} problemData - Los datos originales del problema (red, requisitos).
     * @param {object[]} solution - La solución calculada (array de subredes).
     * @param {'magic'|'wildcard'} method - El método de explicación seleccionado.
     * @returns {string} - Una cadena HTML con la explicación.
     */
    function generateExplanationSteps(problemData, solution, method) {
        // (Función sin cambios respecto a la versión anterior con Magic Number corregido)
        let html = `<h4>Explicación (${method === 'magic' ? 'Magic Number' : 'Wildcard Conceptual'})</h4>`;
        if (!problemData || !solution || solution.length === 0) {
            return html + "<p>No hay datos suficientes para generar la explicación.</p>";
        }
        const isClassful = problemData.requirement !== undefined;

        try {
            if (method === 'magic') {
                if (isClassful) {
                    const initialNetwork = problemData.network;
                    const requirement = problemData.requirement;
                    const firstSubnet = solution[0];
                    const actualPrefix = firstSubnet.prefix;
                    const actualMask = firstSubnet.mask;
                    const defaultMask = getDefaultMask(initialNetwork);
                    const defaultPrefix = getPrefixLength(defaultMask);
                    if (defaultPrefix === null) throw new Error("No se pudo obtener el prefijo por defecto.");
                    const subnetBitsBorrowed = actualPrefix - defaultPrefix;
                    const numGeneratedSubnets = Math.pow(2, subnetBitsBorrowed);
                    html += `<p><strong>1. Red Inicial y Requisito:</strong></p><ul><li>Red Base: <code>${initialNetwork}</code> (Clase ${getIpClass(initialNetwork)})</li><li>Máscara por Defecto: <code>${defaultMask}</code> (/${defaultPrefix})</li><li>Requisito: ${requirement.value} ${requirement.type === 'subnets' ? 'subredes utilizables' : 'hosts utilizables'}</li></ul>`;
                    html += `<p><strong>2. Calcular Nueva Máscara/Prefijo (basado en la solución):</strong></p><ul>`;
                    if (requirement.type === 'subnets') {
                        const strictlyNeededBits = bitsForSubnets(requirement.value);
                        const totalSubnetsNeeded = (subnetBitsBorrowed > 0 && numGeneratedSubnets >= 4) ? requirement.value + 2 : requirement.value;
                        const neededBitsForTotal = bitsForSubnets(totalSubnetsNeeded);
                        if (subnetBitsBorrowed === neededBitsForTotal) { html += `<li>Para obtener ${requirement.value} subredes utilizables (considerando N+2 histórico si aplica), se necesitan ${subnetBitsBorrowed} bits de subred (2<sup>${subnetBitsBorrowed}</sup> = ${numGeneratedSubnets} totales).</li>`; }
                        else { html += `<li>Para satisfacer el requisito, se determinó que se necesitaban <strong>${subnetBitsBorrowed}</strong> bits de subred.</li>`; html += `<li>(Generando 2<sup>${subnetBitsBorrowed}</sup> = ${numGeneratedSubnets} subredes totales).</li>`; }
                    } else {
                        const neededHostBits = 32 - actualPrefix;
                        html += `<li>Para alojar al menos ${requirement.value} hosts utilizables, se necesitan ${neededHostBits} bits de host (2<sup>${neededHostBits}</sup> = ${Math.pow(2, neededHostBits)} >= ${requirement.value} + 2).</li>`;
                        html += `<li>Esto requiere tomar prestados (32 - ${defaultPrefix} - ${neededHostBits}) = <strong>${subnetBitsBorrowed}</strong> bits para la subred.</li>`;
                    }
                    html += `<li>Nuevo Prefijo = Prefijo Default + Bits Prestados = ${defaultPrefix} + ${subnetBitsBorrowed} = <strong>${actualPrefix}</strong>.</li>`;
                    html += `<li>Nueva Máscara: <code>${actualMask}</code> (/${actualPrefix})</li></ul>`;
                    html += `<p><strong>3. Calcular el "Magic Number" (Salto o Tamaño de Bloque):</strong></p><ul>`;
                    const blockSize = getTotalHosts(actualPrefix);
                    html += `<li>El tamaño de cada bloque de subred es 2<sup>(32 - ${actualPrefix})</sup> = 2<sup>${32-actualPrefix}</sup> = <strong>${blockSize.toLocaleString()}</strong> direcciones.</li>`;
                    const maskOctets = actualMask.split('.').map(Number);
                    let interestingOctetIndex = -1; let magicNumber = null;
                    for (let i = 0; i < 4; i++) { if (maskOctets[i] < 255) { interestingOctetIndex = i; break; } }
                    if (interestingOctetIndex !== -1 && actualPrefix < 31) {
                        magicNumber = 256 - maskOctets[interestingOctetIndex];
                        html += `<li>El octeto interesante (donde la máscara cambia) es el <strong>${interestingOctetIndex + 1}º</strong>.</li>`;
                        html += `<li>El "Magic Number" (incremento en ese octeto) es 256 - ${maskOctets[interestingOctetIndex]} = <strong>${magicNumber}</strong>.</li>`;
                    } else if (actualPrefix >= 31) { html += `<li>Con prefijos /31 o /32, el concepto de Magic Number no aplica igual...</li>`; }
                    html += `</ul>`;
                    html += `<p><strong>4. Listar las Subredes Generadas (${numGeneratedSubnets} en total):</strong></p>`;
                    const baseNetworkForListing = getNetworkAddress(initialNetwork, defaultMask);
                    html += `<p>Comenzando desde <code>${baseNetworkForListing}</code> y usando el Magic Number (${magicNumber !== null ? magicNumber : 'N/A'}) en el ${interestingOctetIndex !== -1 ? (interestingOctetIndex + 1) + 'º octeto' : 'octeto relevante'} (o sumando ${blockSize.toLocaleString()}):</p><ul>`;
                    solution.forEach((subnet, index) => {
                        let label = '';
                        if (numGeneratedSubnets >= 2) { if (index === 0) label = ' (Subnet Zero)'; if (index === numGeneratedSubnets - 1) label = ' (All-Ones Subnet)'; }
                        html += `<li>Subred ${index + 1}${label}: <code>${subnet.networkAddress}/${subnet.prefix}</code></li>`;
                    });
                    html += `</ul>`;
                    if (numGeneratedSubnets >= 2) { html += `<p><small><i>Nota: Modernamente todas son usables...</i></small></p>`; }
                } else { // VLSM
                    const initialCIDR = problemData.network; const requirements = problemData.requirements;
                    html += `<p><strong>1. Bloque Inicial:</strong> <code>${initialCIDR}</code></p>`;
                    html += `<p><strong>2. Asignación de Subredes:</strong></p><ol>`;
                    let currentAvailable = initialCIDR.split('/')[0];
                    solution.forEach((subnet, index) => {
                        const req = requirements[index]; const neededHostBits = bitsForHosts(req.hosts);
                        const prefix = 32 - neededHostBits; const blockSize = getTotalHosts(prefix);
                        html += `<li><strong>Req: ${req.name} (${req.hosts} hosts)</strong><ul>`;
                        html += `<li>Bits host: ${neededHostBits}, Prefijo: /${prefix}, Máscara: <code>${getMaskStringFromPrefix(prefix)}</code>, Tamaño: ${blockSize.toLocaleString()}</li>`;
                        html += `<li>Buscando desde <code>${currentAvailable}</code>...</li>`;
                        html += `<li>**Asignado:** <code>${subnet.networkAddress}/${subnet.prefix}</code></li>`;
                        html += `<li>Broadcast: <code>${subnet.broadcastAddress}</code>, Rango: ${subnet.firstUsable ? `<code>${subnet.firstUsable}</code> - <code>${subnet.lastUsable}</code>` : 'N/A'}</li>`;
                        html += `</ul></li>`;
                        currentAvailable = getNextAvailableNetwork(subnet.networkAddress, subnet.prefix) || '(Agotado)';
                    });
                    html += `</ol>`;
                }
            } else if (method === 'wildcard') {
                 html += `<p>La máscara wildcard es la inversa...</p>`;
                if (isClassful) {
                     const firstSubnet = solution[0]; const newMask = firstSubnet.mask; const newPrefix = firstSubnet.prefix;
                     const wildcardInt = (~ipToInt(newMask)) >>> 0; const wildcardMask = intToIp(wildcardInt);
                     html += `<p>Para máscara <code>${newMask}</code> (/${newPrefix}), wildcard: <code>${wildcardMask}</code>.</p>`;
                     html += `<p><strong>Cálculo Broadcast (Ej: Subred 1 ${solution[0].networkAddress}):</strong></p><ul>`;
                     html += `<li>Broadcast = Red | Wildcard = <code>${solution[0].networkAddress} | ${wildcardMask}</code> = <code>${solution[0].broadcastAddress}</code>.</li></ul>`;
                     html += `<p>IPs usables: Red+1 a Broadcast-1.</p>`;
                } else { // VLSM
                     html += `<p>En VLSM, cada subred tiene su wildcard.</p><ol>`;
                     solution.forEach((subnet) => {
                         const wildcardInt = (~ipToInt(subnet.mask)) >>> 0; const wildcardMask = intToIp(wildcardInt);
                         html += `<li><strong>${subnet.name} (${subnet.networkAddress}/${subnet.prefix})</strong><ul>`;
                         html += `<li>Máscara: <code>${subnet.mask}</code> | Wildcard: <code>${wildcardMask}</code></li>`;
                         html += `<li>Broadcast = <code>${subnet.networkAddress} | ${wildcardMask}</code> = <code>${subnet.broadcastAddress}</code></li>`;
                         html += `<li>Rango Usable: ${subnet.firstUsable ? `<code>${subnet.firstUsable}</code> - <code>${subnet.lastUsable}</code>` : 'N/A'}</li></ul></li>`;
                     });
                     html += `</ol>`;
                }
                html += "<p><em>Nota: Explicación conceptual.</em></p>";
            } else {
                html += "<p>Método de explicación no reconocido.</p>";
            }
        } catch (error) {
            console.error("ERROR en generateExplanationSteps:", error);
            html += `<p style="color: red;"><strong>Error al generar la explicación:</strong> ${error.message || 'Error desconocido'}</p>`;
        }
        return html;
    }


    // --- ASIGNACIÓN DE EVENT LISTENERS ---
    if(btnCalculatorMode && btnExerciseMode) {
        btnCalculatorMode.addEventListener('click', () => switchMode('calculator'));
        btnExerciseMode.addEventListener('click', () => switchMode('exercise'));
    }
    if(calcTypeRadios.length > 0) {
        calcTypeRadios.forEach(radio => { radio.addEventListener('change', (event) => { switchCalculatorForm(event.target.value); }); });
    }
     if(classfulNetworkIpInput && classfulIpInfoSpan) {
         classfulNetworkIpInput.addEventListener('input', () => {
             clearError(classfulNetworkIpInput); const ip = classfulNetworkIpInput.value.trim(); let info = '';
             if (isValidIp(ip)) { const ipClass = getIpClass(ip); const defaultMask = getDefaultMask(ip);
                if(ipClass && defaultMask) info = `Clase ${ipClass}, Máscara Default: ${defaultMask}`;
                else if (ipClass) info = `Clase ${ipClass} (Rango especial)`; else info = 'IP válida'; }
             else if (ip !== '') info = 'Escribiendo IP...'; classfulIpInfoSpan.textContent = info;
         });
         classfulNetworkIpInput.addEventListener('blur', () => {
             const ip = classfulNetworkIpInput.value.trim();
             if (ip !== '' && !isValidIp(ip)) displayError(classfulNetworkIpInput, 'Formato de IP inválido.');
             else if (ip !== '') clearError(classfulNetworkIpInput);
         });
     }
    if(classfulForm) {
        classfulForm.addEventListener('submit', (event) => {
            event.preventDefault(); clearCalculatorResults(); clearError(calcTableContainer);
            const networkIp = classfulNetworkIpInput.value.trim();
            const selectedReqRadio = classfulForm.querySelector('input[name="classfulRequirement"]:checked');
            if (!isValidIp(networkIp)) { displayError(calcTableContainer, 'IP inválida.'); return; }
            if (!selectedReqRadio) { displayError(calcTableContainer, 'Selecciona requisito.'); return; }
            const requirement = { type: selectedReqRadio.value };
            requirement.value = parseInt(requirement.type === 'subnets' ? numSubnetsInput.value : numHostsInput.value, 10);
            if (isNaN(requirement.value) || requirement.value <= 0) { displayError(calcTableContainer, 'Valor de requisito inválido.'); return; }
            const result = calculateClassful(networkIp, requirement);
            displayCalculatorResults(result);
        });
    }
    // Botón Limpiar Classful
    if(resetClassfulBtn) {
        resetClassfulBtn.addEventListener('click', () => {
            resetClassfulFormInputs();
            clearCalculatorResults();
        });
    }

    if(addVlsmRequirementBtn && vlsmRequirementsContainer) {
        addVlsmRequirementBtn.addEventListener('click', addVlsmRequirementRow);
        vlsmRequirementsContainer.addEventListener('click', (event) => { if (event.target.classList.contains('remove-req')) { removeVlsmRequirementRow(event.target); } });
    }
    if(vlsmForm) {
        vlsmForm.addEventListener('submit', (event) => {
            event.preventDefault(); clearCalculatorResults(); clearError(calcTableContainer);
            const networkIpWithPrefix = vlsmNetworkIpInput.value.trim();
            const initialNetworkInfo = parseIpAndPrefix(networkIpWithPrefix);
            if (!initialNetworkInfo) { displayError(calcTableContainer, 'Red/prefijo VLSM inválido.'); return; }
            const requirements = []; const requirementRows = vlsmRequirementsContainer.querySelectorAll('.vlsm-requirement');
            let reqError = false;
            requirementRows.forEach((row, index) => {
                const hostsInput = row.querySelector('input[type="number"]'); const nameInput = row.querySelector('input[type="text"]');
                const hosts = parseInt(hostsInput.value, 10); const name = nameInput.value.trim() || null;
                if (isNaN(hosts) || hosts < 0) { displayError(calcTableContainer, `Error req #${index + 1}: Hosts inválidos.`); reqError = true; }
                 if (!reqError) requirements.push({ hosts, name });
            });
            if (reqError) return;
            if (requirements.length === 0) { displayError(calcTableContainer, 'Añade requisitos.'); return; }
            requirements.sort((a, b) => b.hosts - a.hosts);
            const result = calculateVLSM(networkIpWithPrefix, requirements);
            displayCalculatorResults(result);
        });
    }
     // Botón Limpiar VLSM
    if(resetVlsmBtn) {
        resetVlsmBtn.addEventListener('click', () => {
            resetVlsmFormInputs();
            clearCalculatorResults();
        });
    }

    // --- Event Listeners Ejercicios ---
    if(generateExerciseBtn && exerciseTypeSelect) {
        generateExerciseBtn.addEventListener('click', () => {
            const type = exerciseTypeSelect.value; let exerciseData = null;
            if (type === 'classful') exerciseData = generateClassfulProblem();
            else exerciseData = generateVLSMProblem();
            if (exerciseData) displayExercise(exerciseData);
            else exercisePromptDiv.innerHTML = '<h3>Problema:</h3><p>Error al generar ejercicio...</p>';
        });
    }
    if(checkAnswerBtn) {
        checkAnswerBtn.addEventListener('click', () => {
            if (!currentExerciseData || !currentExerciseData.solution) { alert("Genera un ejercicio primero."); return; }
            const userAnswers = getUserAnswers();
            const comparisonResult = compareAnswers(userAnswers, currentExerciseData.solution);
            displayFeedback(comparisonResult);
        });
    }
    if (showSolutionBtn) {
        showSolutionBtn.addEventListener('click', () => {
            if (currentExerciseData && currentExerciseData.solution) {
                displaySolution(currentExerciseData.solution);
                showSolutionBtn.style.display = 'none';
            }
        });
    } else { console.error("Elemento #showSolutionBtn no encontrado."); }
    if(showSolutionStepsBtn && exerciseExplanationMethodSelect && solutionStepsContentDiv) {
        showSolutionStepsBtn.addEventListener('click', () => {
            if (!currentExerciseData || !currentExerciseData.problemData || !currentExerciseData.solution) {
                solutionStepsContentDiv.innerHTML = '<p>Error: No hay datos disponibles...</p>';
                solutionStepsContentDiv.style.display = 'block'; return;
            }
            const method = exerciseExplanationMethodSelect.value;
            try {
                const explanationHTML = generateExplanationSteps(currentExerciseData.problemData, currentExerciseData.solution, method);
                solutionStepsContentDiv.innerHTML = explanationHTML;
                solutionStepsContentDiv.style.display = 'block';
            } catch (error) {
                 console.error("ERROR al mostrar pasos:", error);
                 solutionStepsContentDiv.innerHTML = `<p style="color: red;"><strong>Ocurrió un error...</strong></p>`;
                 solutionStepsContentDiv.style.display = 'block';
            }
        });
    } else { console.error("Faltan elementos para 'Mostrar Pasos'."); }

    // --- INICIALIZACIÓN ---
    updateFooterYear();
    switchMode('calculator');
    switchCalculatorForm('vlsm');

}); // Fin de DOMContentLoaded
