export interface Config {
    caName: string;
    channelName: string;
    chaincodeName: string;
    mspID: string;
    hlfUser: string;
    networkConfigPath: string;
}

export const config: Config = {
    caName: process.env.CA_NAME,
    channelName: process.env.CHANNEL_NAME,
    chaincodeName: process.env.CHAINCODE_NAME,
    mspID: process.env.MSP_ID,
    hlfUser: process.env.HLF_USER,
    networkConfigPath: process.env.NETWORK_CONFIG_PATH,
}

export function checkConfig() {
    if (!config.caName) {
        throw new Error("CA_NAME is not set");
    }
    if (!config.channelName) {
        throw new Error("CHANNEL_NAME is not set");
    }
    if (!config.chaincodeName) {
        throw new Error("CHAINCODE_NAME is not set");
    }
    if (!config.mspID) {
        throw new Error("MSP_ID is not set");
    }
    if (!config.hlfUser) {
        throw new Error("HLF_USER is not set");
    }
    if (!config.networkConfigPath) {
        throw new Error("NETWORK_CONFIG_PATH is not set");
    }
}
