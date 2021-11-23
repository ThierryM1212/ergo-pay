'use strict';
import JSONBigInt from 'json-bigint';

export function parseUnsignedTx(str) {
    let json = JSONBigInt.parse(str);
    return {
        id: json.id,
        inputs: json.inputs,
        dataInputs: json.dataInputs,
        outputs: json.outputs.map(output => (parseUtxo(output))),
    };
}
export function parseUtxo(json) {
    return {
        boxId: json.boxId,
        value: json.value.toString(),
        ergoTree: json.ergoTree,
        assets: json.assets.map(asset => ({
            tokenId: asset.tokenId,
            amount: asset.amount.toString(),
        })),
        additionalRegisters: json.additionalRegisters,
        creationHeight: json.creationHeight,
        transactionId: json.transactionId,
        index: json.index
    };
}
