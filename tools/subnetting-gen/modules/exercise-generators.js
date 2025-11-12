/*
 * Archivo: /tools/subnetting-gen/modules/exercise-generators.js
 * MÓDULO REFACTORIZADO: Lógica de Negocio Pura
 * (VERSIÓN 2 - CON DATOS DE FEEDBACK)
 */
"use strict";

import * as NetUtils from './net-utils.js';
import * as SubnetLogic from './subnet-logic.js';

/**
 * Genera los datos para un problema de tipo "Identificar Red" (Modo 2).
 */
export function generateFindNetworkExercise(difficulty) {
    let baseIp = '';
    let prefix = 0;

    switch (difficulty) {
        case 'hard':
            prefix = NetUtils.getRandomInt(9, 15);
            baseIp = `10.${NetUtils.getRandomInt(0, 255)}.${NetUtils.getRandomInt(0, 255)}.0`;
            break;
        case 'medium':
            prefix = NetUtils.getRandomInt(17, 23);
            baseIp = `172.${NetUtils.getRandomInt(16, 31)}.${NetUtils.getRandomInt(0, 255)}.0`;
            break;
        case 'easy':
        default:
            prefix = NetUtils.getRandomInt(25, 30); // ej: /27
            baseIp = `192.168.${NetUtils.getRandomInt(0, 255)}.0`; // ej: 192.168.3.0
            break;
    }

    const maskLong = NetUtils.cidrToMaskLong(prefix);
    const baseNetworkLong = (NetUtils.ipToLong(baseIp) & maskLong) >>> 0;
    const hostBits = 32 - prefix;

    const maxHostVal = (2 ** hostBits) - 1;
    const randomHost = (maxHostVal > 1) ? NetUtils.getRandomInt(1, maxHostVal - 1) : 1;
    const ipLong = (baseNetworkLong + randomHost) >>> 0; // ej: 192.168.3.13

    const ipStr = NetUtils.longToIp(ipLong);
    const maskDdn = NetUtils.longToIp(maskLong); // ej: 255.255.255.224
    const wildcardLong = (~maskLong) >>> 0;
    const networkLong = (ipLong & maskLong) >>> 0; // ej: 192.168.3.0
    const broadcastLong = (networkLong | wildcardLong) >>> 0; // ej: 192.168.3.31

    const maskInputFormat = (Math.random() > 0.5) ? 'cidr' : 'ddn';
    const maskStr = (maskInputFormat === 'cidr') ? `/${prefix}` : maskDdn;

    const solution = {
        network: NetUtils.longToIp(networkLong),
        "mask-ddn": maskDdn,
        "mask-cidr": `/${prefix}`,
        wildcard: NetUtils.longToIp(wildcardLong),
        broadcast: NetUtils.longToIp(broadcastLong),
        firsthost: NetUtils.longToIp(networkLong + 1),
        lasthost: NetUtils.longToIp(broadcastLong - 1)
    };

    // --- DATOS DE FEEDBACK ---
    let interestingOctet = 0;
    if (prefix <= 8) interestingOctet = 1;
    else if (prefix <= 16) interestingOctet = 2;
    else if (prefix <= 24) interestingOctet = 3;
    else interestingOctet = 4;

    const maskOctetValue = parseInt(maskDdn.split('.')[interestingOctet - 1], 10);
    const magicNumber = (maskOctetValue === 255) ? 0 : 256 - maskOctetValue;
    const ipInterestingOctetValue = parseInt(ipStr.split('.')[interestingOctet - 1], 10);
    const networkInterestingOctetValue = parseInt(solution.network.split('.')[interestingOctet - 1], 10);

    const feedbackData = {
        maskInputFormat: maskInputFormat,
        ipStr: ipStr,
        maskDDN: maskDdn,
        ipBin: NetUtils.longToPaddedBinaryString(ipLong),
        maskBin: NetUtils.longToPaddedBinaryString(maskLong),
        prefix: prefix,
        wildcardDDN: solution.wildcard,
        wildcardBin: NetUtils.longToPaddedBinaryString(wildcardLong), // <-- AÑADIDO
        networkBin: NetUtils.longToPaddedBinaryString(networkLong),
        networkDDN: solution.network,
        broadcastDDN: solution.broadcast,
        firstHostDDN: solution.firsthost,
        lastHostDDN: solution.lasthost,
        interestingOctet: interestingOctet,
        interestingOctetValue: maskOctetValue,
        magicNumber: magicNumber,
        magicNumber2x: magicNumber * 2,
        ipInterestingOctetValue: ipInterestingOctetValue,
        networkInterestingOctetValue: networkInterestingOctetValue,
    };
    // --- FIN DATOS DE FEEDBACK ---

    return {
        problemData: { ipStr, maskStr, maskInputFormat },
        problemTemplateKey: 'ex_find_network_problem',
        templateName: 'ex-mode-2-identify-network',
        solution: solution,
        templateVars: {
            'label-mask-ddn': { given: (maskInputFormat === 'ddn') },
            'label-mask-cidr': { given: (maskInputFormat === 'cidr') }
        },
        feedbackData: feedbackData
    };
}

/**
 * Genera los datos para un problema de tipo "Calcular Máscara" (Modo 3).
 * (VERSIÓN 2 - Requiere que el estudiante sepa la clase/máscara por defecto)
 */
export function generateCalculateMaskExercise(difficulty) {
    let baseNetwork, basePrefix, reqType, problemTemplateKey, ipClass;

    switch (difficulty) {
        case 'hard': // Clase A
            baseNetwork = `10.${NetUtils.getRandomInt(0, 255)}.0.0`;
            basePrefix = 8;
            ipClass = 'A';
            break;
        case 'medium': // Clase B
            baseNetwork = `172.${NetUtils.getRandomInt(16, 31)}.0.0`;
            basePrefix = 16;
            ipClass = 'B';
            break;
        case 'easy': // Clase C
        default:
            baseNetwork = `192.168.${NetUtils.getRandomInt(0, 255)}.0`;
            basePrefix = 24;
            ipClass = 'C';
            break;
    }

    const defaultMaskDDN = NetUtils.longToIp(NetUtils.cidrToMaskLong(basePrefix));
    const defaultMaskCIDR = `/${basePrefix}`;
    const defaultHostBits = 32 - basePrefix;

    reqType = (Math.random() > 0.5) ? 'hosts' : 'subnets';
    let reqValue, newPrefix, hostBits, subnetBits, formula, formulaResult, finalBits;

    if (reqType === 'hosts') {
        const maxHostBits = defaultHostBits - 2; // Debe quedar espacio para subredes
        if (maxHostBits <= 2) { return generateCalculateMaskExercise('easy'); } // Evita /31, /32
        reqValue = NetUtils.getRandomInt(10, Math.max(12, (2 ** maxHostBits) / 4)); // Valor aleatorio
        hostBits = Math.ceil(Math.log2(reqValue + 2)); // Bits de host necesarios
        newPrefix = 32 - hostBits;
        subnetBits = newPrefix - basePrefix;
        problemTemplateKey = 'ex_mode3_problem_hosts'; // Clave i18n
        formula = `2^H - 2`;
        finalBits = hostBits;
        formulaResult = `${2 ** finalBits} - 2 = ${(2 ** finalBits) - 2}`;
    } else { // reqType === 'subnets'
        const maxSubnetBits = defaultHostBits - 2; // Debe quedar espacio para hosts
        if (maxSubnetBits <= 2) { return generateCalculateMaskExercise('easy'); }
        reqValue = NetUtils.getRandomInt(4, Math.max(5, (2 ** maxSubnetBits) / 2));
        subnetBits = Math.ceil(Math.log2(reqValue)); // Bits de subred necesarios
        newPrefix = basePrefix + subnetBits;
        hostBits = 32 - newPrefix;
        problemTemplateKey = 'ex_mode3_problem_subnets'; // Clave i18n
        formula = `2^N`;
        finalBits = subnetBits;
        formulaResult = `2^${finalBits} = ${2 ** finalBits}`;
    }

    if (newPrefix <= basePrefix || newPrefix > 30) {
        return generateCalculateMaskExercise(difficulty); // Fallback
    }

    // Objeto Solución (Req 2)
    const solution = {
        "class": ipClass,
        "default-mask": defaultMaskCIDR,
        "new-mask-cidr": `/${newPrefix}`,
        "new-mask-ddn": NetUtils.longToIp(NetUtils.cidrToMaskLong(newPrefix)),
        "total-subnets": 2 ** subnetBits,
        "usable-hosts": (2 ** hostBits) - 2
    };

    // Datos para el Feedback (Req 3)
    const feedbackData = {
        baseNetwork: baseNetwork,
        firstOctet: parseInt(baseNetwork.split('.')[0], 10),
        ipClass: ipClass,
        defaultMask: defaultMaskDDN,
        defaultCidr: defaultMaskCIDR, // <-- (ej: "/24")
        defaultHostBits: defaultHostBits,
        reqType,
        reqValue,
        hostBits,
        subnetBits,
        formula: formula,
        formulaResult: formulaResult,
        finalBits: finalBits,
        newPrefix: newPrefix, // <-- (ej: 28)
        newCidr: `/${newPrefix}`, // <-- (ej: "/28")
        maskDDN: solution['new-mask-ddn'],
        totalSubnets: solution['total-subnets'],
        totalHosts: solution['usable-hosts']
    };

    return {
        problemData: { baseNetwork, hosts: reqValue, subnets: reqValue },
        problemTemplateKey: problemTemplateKey,
        templateName: 'ex-mode-3-calculate-mask',
        solution: solution,
        templateVars: null,
        feedbackData: feedbackData
    };
}

/**
 * Genera los datos para un problema de tipo "Sumarización de Rutas".
 * (VERSIÓN 6 - Lógica de eficiencia variable y categorización)
 */
export function generateSummarizationExercise(difficulty) {
    let basePrefix, numNetworks, bitsParaRedes, startOctetVal, interestingOctet;
    let baseNetworkStr = "";
    let baseIpLong;
    let octetIncrement, longIncrement;

    let networksToRemove = 0;
    let extraFeedback = { isInefficient: false };

    switch (difficulty) {
        case 'hard':
            // Genera bloques de 4 u 8 redes /17 a /23 (Octeto 3)
            basePrefix = NetUtils.getRandomInt(17, 23);
            numNetworks = 2 ** NetUtils.getRandomInt(2, 3); // 4 u 8 redes
            bitsParaRedes = Math.log2(numNetworks);
            interestingOctet = 3;

            // ¡NUEVO! Probabilidad del 40% de crear agujeros
            if (Math.random() < 0.40) {
                if (numNetworks === 4) {
                    // Quita 2 de 4 -> Eficiencia 50% ("Aceptable")
                    networksToRemove = 2;
                } else { // numNetworks es 8
                    // Quita 2, 3, 4, o 5 de 8
                    // 6/8 -> 75% (Eficiente)
                    // 4-5/8 -> 50% - 62.5% ("Aceptable")
                    // 3/8 -> 37.5% ("Ineficiente")
                    networksToRemove = NetUtils.getRandomInt(2, 5);
                }
            }

            octetIncrement = 2 ** (24 - basePrefix);
            startOctetVal = NetUtils.getRandomInt(0, 255 - (octetIncrement * numNetworks));
            startOctetVal = startOctetVal & ~((octetIncrement * numNetworks) - 1);

            baseNetworkStr = `172.${NetUtils.getRandomInt(16, 31)}.${startOctetVal}.0`;
            baseIpLong = NetUtils.ipToLong(baseNetworkStr);
            longIncrement = octetIncrement * 256;
            break;

        case 'medium':
            // Genera bloques de 2 o 4 redes /25 a /28 (Octeto 4)
            basePrefix = NetUtils.getRandomInt(25, 28);
            numNetworks = 2 ** NetUtils.getRandomInt(1, 2); // 2 o 4 redes
            bitsParaRedes = Math.log2(numNetworks);
            interestingOctet = 4;

            // ¡NUEVO! Probabilidad del 25% de crear agujero (si el bloque es de 4)
            if (Math.random() < 0.25 && numNetworks === 4) {
                // Quita 1 de 4 -> Eficiencia 75% ("Eficiente")
                // Quita 2 de 4 -> Eficiencia 50% ("Ineficiente")
                networksToRemove = NetUtils.getRandomInt(1, 2);;
            }

            octetIncrement = 2 ** (32 - basePrefix);
            startOctetVal = NetUtils.getRandomInt(0, 255 - (octetIncrement * numNetworks));
            startOctetVal = startOctetVal & ~((octetIncrement * numNetworks) - 1);

            baseNetworkStr = `192.168.${NetUtils.getRandomInt(0, 255)}.${startOctetVal}`;
            baseIpLong = NetUtils.ipToLong(baseNetworkStr);
            longIncrement = octetIncrement;
            break;

        case 'easy':
        default:
            // Genera bloques de 2 o 4 redes /24 (Octeto 3)
            // Siempre 100% eficiente.
            basePrefix = 24;
            numNetworks = 2 ** NetUtils.getRandomInt(1, 2); // 2 o 4 redes
            bitsParaRedes = Math.log2(numNetworks);
            interestingOctet = 3;

            octetIncrement = 1;
            startOctetVal = NetUtils.getRandomInt(0, 255 - numNetworks);
            startOctetVal = startOctetVal & ~(numNetworks - 1);

            baseNetworkStr = `192.168.${startOctetVal}.0`;
            baseIpLong = NetUtils.ipToLong(baseNetworkStr);
            longIncrement = octetIncrement * 256;
            break;
    }

    // --- LÓGICA DE GENERACIÓN (Unificada para todos los modos) ---

    // 1. Generar la lista de redes COMPLETA
    const fullIpList = [];
    const originalNumNetworks = numNetworks; // Guardar el N° original
    for (let i = 0; i < originalNumNetworks; i++) {
        const currentIpLong = (baseIpLong + (i * longIncrement)) >>> 0;
        fullIpList.push(NetUtils.longToIp(currentIpLong));
    }

    // 2. Crear "agujeros" si 'networksToRemove' fue activado
    const ipList = [...fullIpList];
    let removedNetworks = [];

    if (networksToRemove > 0) {
        let indicesToRemove = new Set();
        // Asegura quitar N redes únicas del medio (no la primera ni la última)
        while (indicesToRemove.size < networksToRemove && indicesToRemove.size < (originalNumNetworks - 2)) {
            indicesToRemove.add(NetUtils.getRandomInt(1, originalNumNetworks - 2));
        }

        // Quitar las redes en orden inverso para no afectar los índices
        const sortedIndices = Array.from(indicesToRemove).sort((a, b) => b - a);
        for (const index of sortedIndices) {
            const removedIp = ipList.splice(index, 1)[0];
            removedNetworks.push(removedIp);
        }

        numNetworks = ipList.length; // Actualiza el N° de redes a usar

        extraFeedback = {
            isInefficient: true,
            totalNetworksInBlock: originalNumNetworks,
            removedNetworksList: removedNetworks.map(ip => `${ip}/${basePrefix}`)
        };
    }

    // 4. Encontrar la ruta de resumen
    const summary = NetUtils.findSummaryRoute(ipList);
    if (!summary) {
        return generateSummarizationExercise('easy'); // Fallback
    }

    const solution = {
        "summary-route": summary.network,
        "summary-mask": `/${summary.prefix}`
    };

    // 5. Preparar datos para el feedback de 5 pasos

    // 5a. Encontrar dinámicamente el octeto interesante
    if (summary.prefix < 8) interestingOctet = 1;
    else if (summary.prefix < 16) interestingOctet = 2;
    else if (summary.prefix < 24) interestingOctet = 3;
    else interestingOctet = 4;

    // Manejar caso donde el prefijo /8, /16, /24 es el resumen
    // y el cambio real está en el *siguiente* octeto
    if (summary.prefix % 8 === 0 && basePrefix > summary.prefix) {
        interestingOctet = (summary.prefix / 8) + 1;
    }

    // 5b. Generar la lista binaria AHORA, usando el octeto correcto
    const binaryList = [];
    for (const currentIpStr of ipList) {
        const octetValue = parseInt(currentIpStr.split('.')[interestingOctet - 1], 10);
        binaryList.push({
            ip: currentIpStr,
            bin: octetValue.toString(2).padStart(8, '0')
        });
    }

    // 5c. Calcular el resto de los datos de feedback
    const fixedOctets = interestingOctet - 1;
    const baseBits = fixedOctets * 8;
    const commonBits = summary.prefix - baseBits;


    const summaryNetLong = NetUtils.ipToLong(summary.network);
    const summaryMaskLong = NetUtils.cidrToMaskLong(summary.prefix);
    const summaryWildcard = (~summaryMaskLong) >>> 0;
    const summaryBroadcastLong = (summaryNetLong | summaryWildcard) >>> 0;
    const summaryRange = `${summary.network} - ${NetUtils.longToIp(summaryBroadcastLong)}`;
    const commonBitsPattern = (binaryList.length > 0) ? binaryList[0].bin.substring(0, commonBits) : "";

    // --- CÁLCULO Y CATEGORIZACIÓN DE EFICIENCIA ---
    const summaryUsedIPs = numNetworks * (2 ** (32 - basePrefix));
    const summaryTotalIPs = 2 ** (32 - summary.prefix);
    const efficiencyPercentage = Math.round((summaryUsedIPs / summaryTotalIPs) * 100);

    // ¡NUEVO! Categorización de eficiencia
    let efficiencyCategory = "";
    if (efficiencyPercentage >= 65) {
        efficiencyCategory = "Eficiente";
    } else if (efficiencyPercentage >= 50) {
        efficiencyCategory = "Aceptable";
    } else {
        efficiencyCategory = "Ineficiente";
    }
    // --- FIN DE LA CATEGORIZACIÓN ---

    const feedbackData = {
        binaryList: binaryList,
        interestingOctet: interestingOctet,
        fixedOctets: fixedOctets,
        basePrefix: basePrefix,
        commonBits: commonBits,
        commonBitsPattern: commonBitsPattern,
        baseBits: baseBits,
        newPrefix: summary.prefix,
        newMaskDDN: NetUtils.longToIp(summaryMaskLong),
        summaryRoute: summary.network,
        summaryMask: `/${summary.prefix}`,
        summaryRange: summaryRange,
        originalNetworkList: ipList.map(ip => `${ip}/${basePrefix}`),
        // --- Datos de eficiencia ---
        summaryTotalIPs: summaryTotalIPs,
        summaryUsedIPs: summaryUsedIPs,
        numNetworks: numNetworks,
        efficiencyPercentage: efficiencyPercentage,
        efficiencyCategory: efficiencyCategory,
        ...extraFeedback
    };

    return {
        problemData: { ipList: ipList, basePrefix: basePrefix },
        problemTemplateKey: 'ex_summarization_problem',
        templateName: 'ex-mode-4-summarization',
        solution: solution,
        templateVars: null,
        feedbackData: feedbackData
    };
}

/**
 * Genera los datos para un problema de tipo "Subneteo Classful Histórico" (Modo 1).
 * (VERSIÓN 2 - Añade datos de feedback detallados)
 */
export function generateClassfulExercise(difficulty) {
    let baseNetwork = '';
    let reqType = 'subnets';
    let reqValue = 0;
    let targetSubnetIndex = 0;
    let basePrefix = 0;
    let defaultHostBits = 0;

    switch (difficulty) {
        case 'hard':
            baseNetwork = '10.0.0.0';
            basePrefix = 8;
            defaultHostBits = 24;
            reqType = (Math.random() > 0.5) ? 'subnets' : 'hosts';
            reqValue = NetUtils.getRandomInt(500, 1000);
            targetSubnetIndex = NetUtils.getRandomInt(1, 20);
            break;
        case 'medium':
            baseNetwork = '172.16.0.0';
            basePrefix = 16;
            defaultHostBits = 16;
            reqType = (Math.random() > 0.5) ? 'subnets' : 'hosts';
            reqValue = NetUtils.getRandomInt(100, 500);
            targetSubnetIndex = NetUtils.getRandomInt(1, 10);
            break;
        case 'easy':
        default:
            baseNetwork = '192.168.1.0';
            basePrefix = 24;
            defaultHostBits = 8;
            reqType = (Math.random() > 0.5) ? 'subnets' : 'hosts';
            reqValue = NetUtils.getRandomInt(3, 6);
            targetSubnetIndex = NetUtils.getRandomInt(1, reqValue);
            break;
    }

    // --- INICIO: Lógica de Feedback ---
    let totalSubnetsNeeded = 0;
    let hostBitsNeeded = 0;
    let bitsNeeded = 0; // bits 'n'
    let formula = "";
    let formulaResult = "";

    if (reqType === 'subnets') {
        totalSubnetsNeeded = reqValue + 2;
        bitsNeeded = Math.ceil(Math.log2(totalSubnetsNeeded));
        formula = `2^n >= N`;
        formulaResult = `2^${bitsNeeded} = ${2 ** bitsNeeded}`;
    } else { // hosts
        hostBitsNeeded = Math.ceil(Math.log2(reqValue + 2));
        bitsNeeded = defaultHostBits - hostBitsNeeded;
        formula = `2^H - 2 >= N`;
        formulaResult = `2^${hostBitsNeeded} - 2 = ${2 ** hostBitsNeeded - 2}`;
    }

    if (bitsNeeded < 2 || bitsNeeded > defaultHostBits - 2) {
        return generateClassfulExercise('easy'); // Fallback
    }
    // --- FIN: Lógica de Feedback ---

    // El cálculo real
    const calc = SubnetLogic.calculateClassful(baseNetwork, reqType, reqValue);
    if (calc.error) {
        console.warn("Error en Classful, fallback:", calc.error);
        return generateClassfulExercise('easy');
    }

    const usableSubnets = calc.subnets.filter(s => s.isUsableAccordingToConvention);
    const finalTargetIndex = Math.max(0, Math.min(targetSubnetIndex, usableSubnets.length - 1));
    const targetSubnet = usableSubnets[finalTargetIndex];

    const solution = {
        cidr: `/${calc.summary.newCidr}`,
        totalsubnets: calc.summary.totalSubnetsGenerated,
        usablesubnets: calc.summary.usableSubnetsConvention,
        usablehosts: calc.summary.usableHostsPerSubnet,
        targetnet: targetSubnet.network,
        targetrange: targetSubnet.hostRange
    };

    // --- DATOS DE FEEDBACK (Completos) ---
    const feedbackData = {
        reqType: reqType,
        reqValue: reqValue,
        totalSubnetsNeeded: totalSubnetsNeeded, // ej: 8
        hostBitsNeeded: hostBitsNeeded, // ej: 5
        formula: formula,
        formulaResult: formulaResult,
        bitsNeeded: calc.summary.bitsBorrowed, // ej: 3
        defaultCidr: basePrefix, // ej: 24
        defaultHostBits: defaultHostBits, // ej: 8
        newCidr: calc.summary.newCidr, // ej: 27
        maskDDN: calc.subnets[0].mask, // ej: 255.255.255.224
        totalSubnets: calc.summary.totalSubnetsGenerated, // ej: 8
        usableSubnets: calc.summary.usableSubnetsConvention, // ej: 6
        hostBitsFinal: 32 - calc.summary.newCidr, // ej: 5
        usableHosts: calc.summary.usableHostsPerSubnet // ej: 30
    };
    // --- FIN DATOS DE FEEDBACK ---

    return {
        problemData: { baseNetwork, reqType, value: reqValue },
        problemTemplateKey: 'ex_classful_problem',
        templateName: 'ex-mode-1-classful',
        solution: solution,
        templateVars: {
            'label-targetnet': { index: finalTargetIndex + 1 },
            'label-targetrange': { index: finalTargetIndex + 1 }
        },
        fullCalcResult: calc,
        feedbackData: feedbackData
    };
}

/**
 * Genera los datos para un problema de tipo "VLSM" (Modo 5).
 */
export function generateVlsmExercise(difficulty) {
    let baseCidr = '';
    let requirements = []; // Almacenará { nameKey: '...', hosts: ... }

    switch (difficulty) {
        case 'hard':
            baseCidr = '10.0.0.0/16';
            requirements = [
                { nameKey: 'ex_vlsm_req_corp', hosts: NetUtils.getRandomInt(1000, 2000) },
                { nameKey: 'ex_vlsm_req_sales', hosts: NetUtils.getRandomInt(500, 1000) },
                { nameKey: 'ex_vlsm_req_it', hosts: NetUtils.getRandomInt(200, 400) },
                { nameKey: 'ex_vlsm_req_mkt', hosts: NetUtils.getRandomInt(50, 100) },
                { nameKey: 'ex_vlsm_req_wan1', hosts: 2 },
                { nameKey: 'ex_vlsm_req_wan2', hosts: 2 }
            ];
            break;
        case 'medium':
            baseCidr = '172.16.0.0/22';
            requirements = [
                { nameKey: 'ex_vlsm_req_neta', hosts: NetUtils.getRandomInt(200, 400) },
                { nameKey: 'ex_vlsm_req_netb', hosts: NetUtils.getRandomInt(50, 100) },
                { nameKey: 'ex_vlsm_req_netc', hosts: NetUtils.getRandomInt(10, 20) }
            ];
            break;
        case 'easy':
        default:
            baseCidr = '192.168.1.0/24';
            requirements = [
                { nameKey: 'ex_vlsm_req_admin', hosts: NetUtils.getRandomInt(40, 60) },
                { nameKey: 'ex_vlsm_req_support', hosts: NetUtils.getRandomInt(10, 25) }
            ];
            break;
    }

    // El generador de VLSM ya pasa 'nameKey'
    const calc = SubnetLogic.calculateVlsm(baseCidr, requirements);
    if (calc.error) {
        return generateVlsmExercise('easy'); // Fallback
    }

    const solution = {};
    const templateVars = {};
    let reqIndex = 1;

    for (const subnet of calc.subnets) {
        if (subnet.status === 'assigned') {
            const netKey = `net${reqIndex}`;
            solution[`${netKey}_net`] = subnet.network;
            solution[`${netKey}_cidr`] = `/${subnet.cidr}`;
            templateVars[`label-${netKey}_net`] = { nameKey: subnet.nameKey, key: 'ex_vlsm_req_network_address' };
            templateVars[`label-${netKey}_cidr`] = { nameKey: subnet.nameKey, key: 'ex_vlsm_req_mask_cidr' };
            reqIndex++;
        }
    }

    // --- DATOS DE FEEDBACK ---
    // El feedback de VLSM es la propia tabla, que se muestra con "Mostrar Solución"
    // y la función `renderResults` de la calculadora.
    // Por ahora, solo pasamos un flag.
    const feedbackData = {
        isVlsm: true,
        fullCalcResult: calc // Pasamos el resultado completo para el renderizador
    };
    // --- FIN DATOS DE FEEDBACK ---

    return {
        problemData: { baseCidr, requirements, difficulty },
        problemTemplateKey: 'ex_vlsm_problem',
        templateName: 'ex-mode-5-vlsm-row',
        isDynamicList: true,
        reqCount: calc.subnets.filter(s => s.status === 'assigned').length,
        solution: solution,
        templateVars: templateVars,
        fullCalcResult: calc, // <-- AÑADIDO (ya estaba, pero es clave)
        feedbackData: feedbackData // <-- AÑADIDO
    };
}

/**
 * Genera los datos para un problema de tipo "Siguiente Red" (Modo 6).
 */
export function generateNextNetworkExercise(difficulty) {
    let baseNetworkLong, prefix;

    switch (difficulty) {
        case 'hard':
            prefix = NetUtils.getRandomInt(9, 15);
            baseNetworkLong = (NetUtils.ipToLong(`10.0.0.0`) & NetUtils.cidrToMaskLong(prefix)) >>> 0;
            // Asegurarse de que no sea la primera subred para que el salto sea interesante
            baseNetworkLong += NetUtils.getRandomInt(1, 10) * (2 ** (32 - prefix));
            break;
        case 'medium':
            prefix = NetUtils.getRandomInt(17, 23);
            baseNetworkLong = (NetUtils.ipToLong(`172.16.0.0`) & NetUtils.cidrToMaskLong(prefix)) >>> 0;
            baseNetworkLong += NetUtils.getRandomInt(1, 10) * (2 ** (32 - prefix));
            break;
        case 'easy':
        default:
            prefix = NetUtils.getRandomInt(25, 30);
            baseNetworkLong = (NetUtils.ipToLong(`192.168.1.0`) & NetUtils.cidrToMaskLong(prefix)) >>> 0;
            const magicNum = 2 ** (32 - prefix);
            // Asegurarse de que no sea la red .0 y que no sea la última
            let randomMultiple = NetUtils.getRandomInt(1, Math.floor(255 / magicNum) - 2);
            if (randomMultiple <= 0) randomMultiple = 1; // Fallback
            baseNetworkLong += (randomMultiple * magicNum);
            break;
    }

    const blockSize = (2 ** (32 - prefix)) >>> 0;
    const nextNetworkLong = (baseNetworkLong + blockSize) >>> 0;
    const networkCidr = `${NetUtils.longToIp(baseNetworkLong)}/${prefix}`;

    const solution = {
        "next-network": NetUtils.longToIp(nextNetworkLong)
    };

    // --- INICIO: SECCIÓN DE FEEDBACK ACTUALIZADA ---

    // 1. Identificar Octeto Interesante
    let octet;
    if (prefix >= 24) octet = 4;
    else if (prefix >= 16) octet = 3;
    else if (prefix >= 8) octet = 2;
    else octet = 1;

    // 2. Encontrar el "Número Mágico" (Salto)
    const maskLong = NetUtils.cidrToMaskLong(prefix);
    const maskDDN = NetUtils.longToIp(maskLong);
    const octetValue = parseInt(maskDDN.split('.')[octet - 1], 10);
    // El salto se calcula en el octeto interesante (ej: 256 - 252 = 4)
    const magicNumber = (octetValue === 255) ? 0 : 256 - octetValue;

    // 3. Calcular Siguiente Salto
    const networkStr = NetUtils.longToIp(baseNetworkLong);
    const networkOctet = parseInt(networkStr.split('.')[octet - 1], 10);
    const nextNetworkOctet = networkOctet + magicNumber;

    // 4. Definir Siguiente Red
    const nextNetwork = NetUtils.longToIp(nextNetworkLong);

    const feedbackData = {
        networkCidr: networkCidr,
        prefix: prefix,
        octet: octet,                   // (Paso 1)
        maskDDN: maskDDN,               // (Paso 2)
        octetValue: octetValue,         // (Paso 2)
        magicNumber: magicNumber,       // (Paso 2)
        networkOctet: networkOctet,     // (Paso 3)
        nextNetworkOctet: nextNetworkOctet, // (Paso 3)
        nextNetwork: nextNetwork        // (Paso 4)
    };
    // --- FIN: SECCIÓN DE FEEDBACK ACTUALIZADA ---

    return {
        problemData: { networkCidr },
        problemTemplateKey: 'ex_next_network_problem',
        templateName: 'ex-mode-6-next-network',
        solution: solution,
        templateVars: null,
        feedbackData: feedbackData // <-- Objeto de feedback poblado
    };
}

/**
 * Genera un problema placeholder para modos no implementados.
 */
export function generateComingSoon() {
    return {
        problemData: null,
        problemTemplateKey: 'ex_coming_soon_desc',
        templateName: 'ex-mode-coming-soon',
        solution: null,
        templateVars: null,
        feedbackData: null // <-- AÑADIDO
    };
}

/**
 * Objeto que mapea los tipos de ejercicio a sus funciones generadoras.
 */
export const generators = {
    'identify-network': generateFindNetworkExercise,
    'classful-legacy': generateClassfulExercise,
    'calculate-mask': generateCalculateMaskExercise,
    'summarization': generateSummarizationExercise,
    'next-network': generateNextNetworkExercise,
    'vlsm-scenario': generateVlsmExercise
};