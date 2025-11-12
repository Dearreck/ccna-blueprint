/*
 * Archivo: /tools/subnetting-gen/modules/subnet-logic.js
 * Contiene la lógica de cálculo principal para Classful y VLSM.
 */
"use strict";

import { getNetworkClass, getDefaultMask, ipToLong, longToIp, cidrToMaskLong } from './net-utils.js';

/**
 * Lógica de Cálculo (Classful)
 */
export function calculateClassful(ip, reqType, reqValue) {
    const ipClass = getNetworkClass(ip);
    const defaultMaskInfo = getDefaultMask(ipClass);

    if (!defaultMaskInfo) {
        return { error: `La dirección IP ${ip} no pertenece a una clase A, B o C utilizable.` };
    }

    const baseIpLong = ipToLong(ip);
    const networkAddressLong = (baseIpLong & defaultMaskInfo.maskLong) >>> 0;

    if (baseIpLong !== networkAddressLong) {
        const correctNetworkAddress = longToIp(networkAddressLong);
        const ipClassForGivenIp = getNetworkClass(ip);
        const defaultMaskForGivenIp = getDefaultMask(ipClassForGivenIp);

        if (defaultMaskForGivenIp) {
            return { error: `La IP ${ip} no es una dirección de red para su clase (${ipClassForGivenIp}). La dirección de red correcta es ${correctNetworkAddress}/${defaultMaskForGivenIp.cidr}. Usa esa o una IP válida.` };
        } else {
            return { error: `La IP ${ip} no pertenece a una clase A, B o C utilizable.` };
        }
    }

    let bitsNeeded = 0;
    const defaultHostBits = 32 - defaultMaskInfo.cidr;

    if (reqType === 'subnets') {
        bitsNeeded = Math.ceil(Math.log2(reqValue + 2));
    } else { // reqType === 'hosts'
        const hostBitsNeeded = Math.ceil(Math.log2(reqValue + 2));
        if (hostBitsNeeded > defaultHostBits - 2) {
            return { error: `Se requieren ${hostBitsNeeded} bits para ${reqValue} hosts usables, pero solo hay ${defaultHostBits} bits de host disponibles en la clase ${ipClass} (dejando menos de 2 bits para subredes).` };
        }
        bitsNeeded = defaultHostBits - hostBitsNeeded;
    }

    if (bitsNeeded < 2 || bitsNeeded > defaultHostBits - 2) {
        if (reqType === 'subnets') {
            return { error: `El requisito de ${reqValue} subredes usables (requiere ${bitsNeeded} bits) excede los ${defaultHostBits - 2} bits disponibles para subneteo en la clase ${ipClass} o es menor al mínimo requerido (2 bits).` };
        } else {
            return { error: `El requisito de ${reqValue} hosts usables (resulta en ${bitsNeeded} bits de subred) excede los ${defaultHostBits - 2} bits disponibles para subneteo en la clase ${ipClass} o es menor al mínimo requerido (2 bits).` };
        }
    }

    const newCidr = defaultMaskInfo.cidr + bitsNeeded;
    const newMaskLong = cidrToMaskLong(newCidr);
    const newMaskDotted = longToIp(newMaskLong);

    const subnets = [];
    const totalSubnets = 2 ** bitsNeeded;
    const subnetSize = 2 ** (32 - newCidr);
    const usableHosts = (subnetSize > 2) ? subnetSize - 2 : 0;

    for (let i = 0; i < totalSubnets; i++) {
        const currentNetworkLong = (networkAddressLong + (i * subnetSize)) >>> 0;
        const broadcastLong = (currentNetworkLong + subnetSize - 1) >>> 0;
        const firstHostLong = currentNetworkLong + 1;
        const lastHostLong = broadcastLong - 1;

        let subnetStatus = 'usable';
        let isUsable = true;

        if (i === 0) {
            subnetStatus = 'zero-subnet';
            isUsable = false;
        } else if (i === totalSubnets - 1) {
            subnetStatus = 'all-ones-subnet';
            isUsable = false;
        }

        subnets.push({
            name: `Subred ${i}`,
            network: longToIp(currentNetworkLong),
            mask: newMaskDotted,
            cidr: newCidr,
            hostRange: usableHosts > 0 ? `${longToIp(firstHostLong)} - ${longToIp(lastHostLong)}` : 'N/A',
            broadcast: longToIp(broadcastLong),
            usableHosts: usableHosts,
            status: subnetStatus,
            isUsableAccordingToConvention: isUsable
        });
    }

    const usableSubnetsCount = subnets.filter(s => s.isUsableAccordingToConvention).length;

    const summary = {
        originalNetwork: `${longToIp(networkAddressLong)}/${defaultMaskInfo.cidr}`,
        newMask: `/${newCidr} (${newMaskDotted})`,
        newCidr: newCidr,
        totalSubnetsGenerated: totalSubnets,
        usableSubnetsConvention: usableSubnetsCount,
        usableHostsPerSubnet: usableHosts,
        totalUsableHostsConvention: usableHosts * usableSubnetsCount,
        bitsBorrowed: bitsNeeded
    };

    return { subnets, summary };
}

/**
 * Lógica de Cálculo (VLSM)
 */
export function calculateVlsm(cidrStr, requirements) {
    if (requirements.length === 0) {
        return { error: 'Debe añadir al menos un requisito de subred.' };
    }

    const [ip, prefixStr] = cidrStr.split('/');
    const basePrefix = parseInt(prefixStr, 10);
    const baseMaskLong = cidrToMaskLong(basePrefix);
    const baseNetworkLong = (ipToLong(ip) & baseMaskLong) >>> 0;

    if (ipToLong(ip) !== baseNetworkLong) {
        return { error: `La IP ${ip} no es una dirección de red. La dirección de red es ${longToIp(baseNetworkLong)}/${basePrefix}.` };
    }

    const baseBroadcastLong = (baseNetworkLong | (~baseMaskLong)) >>> 0;
    const totalAvailableHosts = (2 ** (32 - basePrefix)) - 2;

    requirements.sort((a, b) => b.hosts - a.hosts);

    const subnets = [];
    let currentNetworkLong = baseNetworkLong;
    let totalAllocatedHosts = 0;

    for (const req of requirements) {
        const requiredHosts = req.hosts;
        const requiredHostBits = Math.ceil(Math.log2(requiredHosts + 2));
        const subnetSize = 2 ** requiredHostBits;
        const newCidr = 32 - requiredHostBits;

        if (newCidr > 30) {
            subnets.push({
                ...req,
                status: 'error',
                errorMsg: `No se puede asignar ${requiredHosts} hosts (requiere /${newCidr}). Máscara máxima es /30.`
            });
            continue;
        }

        const newMaskLong = cidrToMaskLong(newCidr);
        const broadcastLong = (currentNetworkLong + subnetSize - 1) >>> 0;

        if (broadcastLong > baseBroadcastLong) {
            subnets.push({
                ...req,
                status: 'error',
                errorMsg: `No hay suficiente espacio contiguo para ${requiredHosts} hosts.`
            });
            continue;
        }

        const usableHosts = subnetSize - 2;
        totalAllocatedHosts += subnetSize;

        subnets.push({
            name: req.name || `Subred ${requiredHosts} hosts`,
            nameKey: req.nameKey,
            reqHosts: requiredHosts,
            network: longToIp(currentNetworkLong),
            mask: longToIp(newMaskLong),
            cidr: newCidr,
            hostRange: `${longToIp(currentNetworkLong + 1)} - ${longToIp(broadcastLong - 1)}`,
            broadcast: longToIp(broadcastLong),
            usableHosts: usableHosts,
            allocatedSize: subnetSize,
            efficiency: (requiredHosts / usableHosts) * 100,
            status: 'assigned'
        });

        currentNetworkLong = (broadcastLong + 1) >>> 0;
    }

    let remainingSize = 0;
    let remainingRange = 'N/A';
    if (currentNetworkLong <= baseBroadcastLong) {
        const remainingStart = currentNetworkLong;
        const remainingEnd = baseBroadcastLong;
        remainingSize = (remainingEnd - remainingStart + 1);
        remainingRange = `${longToIp(remainingStart)} - ${longToIp(remainingEnd)}`;
    }

    const summary = {
        originalNetwork: `${longToIp(baseNetworkLong)}/${basePrefix}`,
        totalAvailable: (2 ** (32 - basePrefix)),
        totalAllocated: totalAllocatedHosts,
        efficiency: (totalAllocatedHosts / (2 ** (32 - basePrefix))) * 100,
        totalRemaining: remainingSize,
        remainingRange: remainingRange
    };

    return { subnets, summary };
}