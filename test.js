const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const fs = require("fs");
require("dotenv").config();
const fetch = require("node-fetch");
const { WebSocket } = require('ws');
const { OpenSeaStreamClient, Network, EventType } = require('@opensea/stream-js')
const { ethers, BigNumber } = require('ethers');
const { Connection, PublicKey } = require("@solana/web3.js");
const { programs } = require('@metaplex/js');
const { metadata: { Metadata } } = programs;

const TENSOR_PUBLIC_KEY = "TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN";
const tensorSwap = new PublicKey(TENSOR_PUBLIC_KEY);
const connection = new Connection(`https://solana-mainnet.core.chainstack.com/c0a8359ab8a341c1de887a1313ab8359`, {
    wsEndpoint: `wss://solana-mainnet.core.chainstack.com/ws/c0a8359ab8a341c1de887a1313ab8359`, commitment: 'confirmed'
    // httpHeaders: {"x-session-hash": SESSION_HASH}
});
const botToken = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const osChannelId = process.env.OS_CHANNEL_ID;
const blurChannelId = process.env.BLUR_CHANNEL_ID;
const magicEdenChannelId = process.env.MAGIC_EDEN_CHANNEL_ID;
const ordinalChannelId = process.env.ORDINAL_CHANNEL_ID;
const tensorChannelId = process.env.TENSOR_CHANNEL_ID;
const rpc = process.env.RPC
const api = process.env.OS_API;
const blurMarketAddress = process.env.BLUR_MARKET_ADDRESS.toLowerCase();
const blurMarketProxyAddress = process.env.BLUR_MARKET_PROXY_ADDRESS.toLowerCase();
const magicEdenAddress = process.env.MAGIC_EDEN_ADDRESS.toLowerCase();
const minPrice = Number(process.env.MIN_PRICE)

// Load contracts' ABIs:
const blurMarketABI = fs.readFileSync('./abi/blurMarket.json', 'utf-8');
const magicedenABI = fs.readFileSync('./abi/magicEden.json', 'utf-8');

// setup provider:
const provider = new ethers.providers.JsonRpcProvider(rpc)
const blurContract = new ethers.Contract(blurMarketAddress, blurMarketABI, provider)
const blurProxyContract = new ethers.Contract(blurMarketProxyAddress, blurMarketABI, provider)
const magicedenContract = new ethers.Contract(magicEdenAddress, magicedenABI, provider)

const discordClient = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});
// const client = new OpenSeaStreamClient({
//     network: Network.MAINNET,
//     token: api,
//     connectOptions: {
//         transport: WebSocket
//     }
// });

const checkAvailableEthTokens = async (owner, slug) => {
    const url = `https://api.opensea.io/api/v2/chain/ethereum/account/${owner}/nfts?collection=${slug}`
    const headers = {
        "accept": "application/json",
        "x-api-key": api
    }
    const response = await fetch(url, { method: "GET", headers: headers })
    const resp = await response.json()
    const nfts = resp.nfts
    let nftList = []
    if (nfts && nfts.length > 0) {
        // console.log(nfts);
        console.log("Found NFTs")
        for (const nft of nfts) {
            nftList.push(
                {
                    name: nft.identifier,
                    image: nft.display_image_url,
                    link: nft.opensea_url
                }
            )
        }
        console.log(nftList);
        return nftList
    } else {
        return nftList
    }
}

const buildTestEmbed = async () => {
    let nftEmbeds = []
    const remaining = await checkAvailableEthTokens("0x8c884bda1ccaecbf4515080b5d722a485ff0131d", "thewarlords")
    let remainingValue = ``
    if (remaining && remaining.length > 0) {
        //totalEmbeds.push(remainingEmbedTitle)
        if (remaining.length < 9) {
            for (let i = 0; i < remaining.length; i++) {
                let remainingEmbed = new EmbedBuilder()
                    .setImage(remaining[i].image)
                    .setURL(`https://opensea.io/assets/ethereum/0xeeca64ea9fcf99a22806cd99b3d29cf6e8d54925/751`)
                nftEmbeds.push(remainingEmbed)
                remainingValue += `[${remaining[i].name}](https://opensea.io/assets/ethereum/0xeeca64ea9fcf99a22806cd99b3d29cf6e8d54925/${remaining[i].name})\n`
            }
        } else {
            for (let i = 0; i < 9; i++) {
                let remainingEmbed = new EmbedBuilder()
                    .setImage(remaining[i].image)
                    .setURL(`https://opensea.io/assets/ethereum/0xeeca64ea9fcf99a22806cd99b3d29cf6e8d54925/751`)
                nftEmbeds.push(remainingEmbed)
                remainingValue += `[${remaining[i].name}](https://opensea.io/assets/ethereum/0xeeca64ea9fcf99a22806cd99b3d29cf6e8d54925/${remaining[i].name})\n`
            }
            remainingValue += `...`
        }
        // const remainingEmbedTitle = new EmbedBuilder().setURL(`https://opensea.io/assets/ethereum/0xeeca64ea9fcf99a22806cd99b3d29cf6e8d54925/751`).addFields({
        //     name: 'Remaining NFTs',
        //     value: remainingValue,
        //     inline: false
        // })
        // nftEmbeds.unshift(remainingEmbedTitle)
        // nftEmbeds.unshift(embedMessage)
    } else {
        const remainingEmbedTitle = new EmbedBuilder().setURL(`https://opensea.io/0x53fef1b21643ab41545046be961264d24e4c6003`).addFields({
            name: "Empty",
            value: "Empty",
            inline: false
        })
        nftEmbeds.push(remainingEmbedTitle)
    }
    const embedMessage = new EmbedBuilder()
        .setTitle("OPENSEA DUMP NOTIFICATION")
        .setURL("https://opensea.io/assets/ethereum/0xeeca64ea9fcf99a22806cd99b3d29cf6e8d54925/751")
        .setColor(0x18e1ee)
        .setTimestamp(Date.now())
        .setAuthor({
            url: 'https://twitter.com/longsensei1992',
            iconURL: 'https://pbs.twimg.com/profile_images/1709114338634858496/-utQ4UHv_400x400.jpg',
            name: 'Cute_Louise'
        })
        .setFooter({
            iconURL: 'https://pbs.twimg.com/profile_images/1709114338634858496/-utQ4UHv_400x400.jpg',
            text: 'Powered by Cute_Louise'
        })
        .setImage("https://i.seadn.io/s/raw/files/4b3955f24ff90342aa3a8a79eaa9ea3d.png?auto=format&dpr=1&w=1000")
        .addFields(
            {
                name: 'item: ',
                value: `[751](https://opensea.io/assets/ethereum/0xeeca64ea9fcf99a22806cd99b3d29cf6e8d54925/751)`,
                inline: true
            },
            {
                name: 'price: ',
                value: `0.4983 ` + 'WETH',
                inline: true
            },
            {
                name: 'from: ',
                value: `[0x53fef1b21643ab41545046be961264d24e4c6003](https://opensea.io/0x53fef1b21643ab41545046be961264d24e4c6003)`,
                inline: false
            },
            {
                name: 'to: ',
                value: `[0xeca5a16b1fdcd2e18bda3950a952c6375e5b277d](https://opensea.io/0xeca5a16b1fdcd2e18bda3950a952c6375e5b277d)`,
                inline: false
            },
            {
                name: 'Remaining NFTs',
                value: remainingValue,
                inline: false
            }
        )
        nftEmbeds.unshift(embedMessage)    
    // await discordClient.channels.cache.get("1049941836057280543").send({
    //     embeds: [embedMessage]
    // })
    await discordClient.channels.cache.get("1049941836057280543").send({
        embeds: nftEmbeds
    })
}

discordClient.login(botToken);

discordClient.on("ready", async () => {
    console.log(`Logged in as ${discordClient.user.tag}`)
    await buildTestEmbed()
});
