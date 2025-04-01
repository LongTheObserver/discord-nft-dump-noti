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
const client = new OpenSeaStreamClient({
    network: Network.MAINNET,
    token: api,
    connectOptions: {
        transport: WebSocket
    }
});

const convertBigNumbers = (args) => {
    return args.map(arg => {
        if (arg instanceof BigNumber) {
            return arg.toString();
        } else if (Array.isArray(arg)) {
            return convertBigNumbers(arg);
        }
        return arg;
    });
}

let blurHashes = [];

// Search NFT image on OpenSea:
const searchImg = async (token, id) => {
    try {
        const url = `https://api.opensea.io/api/v2/chain/ethereum/contract/${token}/nfts/${id}`;
        const headers = {
            "accept": "application/json",
            "x-api-key": api
        }
        const res = await fetch(url, { method: "GET", headers: headers });
        const jsonRes = await res.json();
        const img = (jsonRes.nft.image_url == "" ? './no-image.png' : jsonRes.nft.image_url);
        const slug = jsonRes.nft.collection;
        // console.log(img, slug);
        return {
            image: img,
            slug: slug,
        }
    } catch (e) {
        console.log(`Cannot get image of https://opensea.io/assets/ethereum/${token}/${id} due to ${e.message}`);
        return {
            image: './no-image.png',
            slug: token
        }
    }
}

async function getNFTMetadata(nftMintAddress, network = 'mainnet-beta') {

    // Get the metadata PDA
    const metadataPDA = await Metadata.getPDA(new PublicKey(nftMintAddress));

    // Fetch the metadata account
    const metadataAccount = await Metadata.load(connection, metadataPDA);

    // Fetch the metadata JSON
    const response = await fetch(metadataAccount.data.data.uri);
    const metadata = await response.json();

    return metadata.image;
}

const osTrack = async () => {
    try {
        client.onEvents('*',
            [EventType.ITEM_SOLD], async (event) => {
                if (event.payload.payment_token.symbol == "WETH") {
                    let isoEventTime = new Date(event.payload.event_timestamp)
                    let eventTime = await isoEventTime.getTime()
                    let exactEventTime = Math.floor(eventTime / 1000)
                    let now = Math.floor(Date.now() / 1000)
                    // console.log(exactEventTime, DURATION, now);
                    if (exactEventTime + 10 >= now && Number(event.payload.sale_price) / 1e18 > minPrice) {
                        console.log(`Found OpenSea Dump`);
                        // console.log(event.payload.item.permalink, event.payload.taker.address, event.payload.maker.address, event.payload.sale_price);
                        const embedMessage = new EmbedBuilder()
                            .setTitle("OPENSEA DUMP NOTIFICATION")
                            .setURL(event.payload.item.permalink)
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
                            .setImage(event.payload.item.metadata.image_url)
                            .addFields(
                                {
                                    name: 'from',
                                    value: `[${event.payload.taker.address}](https://opensea.io/${event.payload.maker.address})`,
                                    inline: false
                                },
                                {
                                    name: 'to',
                                    value: `[${event.payload.maker.address}](https://opensea.io/${event.payload.taker.address})`,
                                    inline: false
                                },
                                {
                                    name: 'price',
                                    value: `${Number(event.payload.sale_price) / 1e18} ` + 'WETH',
                                    inline: false
                                }
                            )
                        await discordClient.channels.cache.get(osChannelId).send({
                            embeds: [embedMessage]
                        })
                    }
                }
            })
    } catch (e) {
        console.log(JSON.stringify(e));
    }
}

const buildBlurEmbeddedMessage = async (from, to, token, id, amount, hash, img) => {
    try {
        const embedMessage = new EmbedBuilder()
            .setTitle("BLUR DUMP NOTIFICATION")
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
            .setImage(img)
            .addFields(
                {
                    name: 'item',
                    value: `[${id}](https://blur.io/asset/${token}/${id})`
                },
                {
                    name: 'from',
                    value: `[${from}](https://blur.io/${from})`,
                    inline: false
                },
                {
                    name: 'to',
                    value: `[${to}](https://blur.io/${to})`,
                    inline: false
                },
                {
                    name: 'price',
                    value: `${amount} ETH - [View Transaction](https://etherscan.io/tx/${hash})`,
                    inline: false
                }
            )
        return embedMessage
    } catch (e) {
        console.log("Failed to embed message due to error: " + e.message);
    }
}

const handleBlurMessageFromTx = async (tx) => {
    try {
        let hash = tx.hash
        let data = tx.data
        // console.log(data, hash);
        const decodedData = blurProxyContract.interface.parseTransaction({ data: data });
        const decodedArgs = convertBigNumbers(decodedData.args);
        if (data.startsWith("0xda815cb5")) {
            let from = tx.from.toLowerCase();
            let to = decodedArgs[0][0][0].toLowerCase();
            let tokenAddress = decodedArgs[0][0][1].toLowerCase()
            let tokenId = decodedArgs[0][1][3][0]
            let price = Number(decodedArgs[0][1][2][3]) / 1e18
            if (price > minPrice) {
                let image = await searchImg(tokenAddress, tokenId)
                const embedMessage = await buildBlurEmbeddedMessage(from, to, tokenAddress, tokenId, price, hash, image.image)
                await discordClient.channels.cache.get(blurChannelId).send({
                    embeds: [embedMessage]
                })
            }
        } else if (data.startsWith("0x7034d120")) {
            let from = tx.from.toLowerCase();
            for (let i = 0; i < decodedArgs[0][0].length; i++) {
                let to = decodedArgs[0][0][i][0].toLowerCase();
                let tokenAddress = decodedArgs[0][0][i][1].toLowerCase()
                for (let j = 0; j < decodedArgs[0][1].length; j++) {
                    let transaction = {}
                    let tokenId = decodedArgs[0][1][j][3][0]
                    let price = Number(decodedArgs[0][1][j][2][3]) / 1e18
                    transaction["owner"] = to;
                    transaction["item_link"] = `https://blur.io/asset/${tokenAddress}/${tokenId}`
                    transaction["amount"] = price
                    transaction["hash"] = tx.hash
                    let image = await searchImg(tokenAddress, tokenId)
                    if (Number(decodedArgs[0][1][j][0]) == i && price > minPrice) {
                        const embedMessage = await buildBlurEmbeddedMessage(from, to, tokenAddress, tokenId, price, hash, image.image)
                        await discordClient.channels.cache.get(blurChannelId).send({
                            embeds: [embedMessage]
                        })
                    }
                }
            }
        }
    } catch (e) {
        console.log("Failed to parse transaction due to error: " + e.message);
    }
}

const blurTrack721TakerFee = async () => {
    const eventName = 'Execution721TakerFeePacked';
    console.log(`Start tracking on ${eventName} event`);
    blurContract.on(eventName, async (eventParam1, eventParam2, eventParam3, eventParam4, eventDetails) => {
        // console.log(`Parameter 1: ${eventParam1}`);
        // console.log(`Parameter 2: ${eventParam2}`);
        // console.log(`Parameter 3: ${eventParam3}`);
        // console.log(`Parameter 4: ${eventParam4}`);
        // console.log('Event Hash:', eventDetails.transactionHash);
        if (blurHashes.indexOf(eventDetails.transactionHash) === -1) {
            console.log(`${eventName} event detected:`);
            blurHashes.push(eventDetails.transactionHash);
            const tx = await eventDetails.getTransaction();
            await handleBlurMessageFromTx(tx)
        }

    });
}

const blurTrack721 = async () => {
    const eventName = 'Execution721Packed';
    console.log(`Start tracking on ${eventName} event`);
    blurContract.on(eventName, async (eventParam1, eventParam2, eventParam3, eventDetails) => {
        if (blurHashes.indexOf(eventDetails.transactionHash) === -1) {
            console.log(`${eventName} event detected:`);
            blurHashes.push(eventDetails.transactionHash);
            const tx = await eventDetails.getTransaction();
            await handleBlurMessageFromTx(tx)
        }

    });
}

const handleMagicEdenEmbeddedMessageFromEvent = async (from, to, token, id, img, amount, hash) => {
    try {
        const embedMessage = new EmbedBuilder()
            .setTitle("MAGIC EDEN DUMP NOTIFICATION")
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
            .setImage(img)
            .addFields(
                {
                    name: 'item',
                    value: `[${id}](https://magiceden.io/item-details/ethereum/${token}/${id})`
                },
                {
                    name: 'from',
                    value: `[${from}](https://magiceden.io/u/${from})`,
                    inline: false
                },
                {
                    name: 'to',
                    value: `[${to}](https://magiceden.io/u/${to})`,
                    inline: false
                },
                {
                    name: 'price',
                    value: `${amount} WETH - [View Transaction](https://etherscan.io/tx/${hash})`,
                    inline: false
                }
            )
        await discordClient.channels.cache.get(magicEdenChannelId).send({
            embeds: [embedMessage]
        })
    } catch (e) {
        console.log("Failed to embed message due to error: " + e.message);
    }
}

const magicEdenTrack = async () => {
    const eventName = 'AcceptOfferERC721';
    console.log(`Start tracking on ${eventName} event`);
    magicedenContract.on(eventName, async (seller, buyer, tokenAddress, recipient, paymentToken, tokenId, price, eventDetails) => {
        // console.log(`Parameter 1: ${eventParam1}`);
        // console.log(`Parameter 2: ${eventParam2}`);
        // console.log(`Parameter 3: ${eventParam3}`);
        // console.log(`Parameter 4: ${eventParam4}`);
        // console.log('Event Hash:', eventDetails.transactionHash);
        let token = paymentToken.toLowerCase();
        if (token === "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2") {
            console.log(`${eventName} event detected:`);
            let wethPrice = Number(price) / 1e18
            if (wethPrice > minPrice) {
                let image = await searchImg(tokenAddress, tokenId)
                await handleMagicEdenEmbeddedMessageFromEvent(seller, recipient, tokenAddress, tokenId, image.image, wethPrice, eventDetails.transactionHash)
            }
        }
    });
}

const buildOrdinalEmbeddedMessage = async (from, to, id, amount, hash, img) => {
    try {
        const embedMessage = new EmbedBuilder()
            .setTitle("ORDINALS DUMP NOTIFICATION")
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
            .setImage(img)
            .addFields(
                {
                    name: 'item',
                    value: `[${id}](https://magiceden.io/ordinals/item-details/${id})`
                },
                {
                    name: 'from',
                    value: `[${from}](https://magiceden.io/ordinals/wallet?walletAddress=${from})`,
                    inline: false
                },
                {
                    name: 'to',
                    value: `[${to}](https://magiceden.io/ordinals/wallet?walletAddress=${to})`,
                    inline: false
                },
                {
                    name: 'price',
                    value: `${amount} BTC - [View Transaction](https://ordiscan.com/tx/${hash})`,
                    inline: false
                }
            )
        await discordClient.channels.cache.get(ordinalChannelId).send({
            embeds: [embedMessage]
        })
    } catch (e) {
        console.log("Failed to embed message due to error: " + e.message);
    }
}

const ordinalTrack = async () => {
    let txArr = []
    const url = "https://api-mainnet.magiceden.dev/v2/ord/btc/activities/trades?";
    const headers = {
        "accept": "application/json",
        "x-api-key": "f0bbf46a6f6dcc414bda9759da67c648"
    }
    while (1) {
        const res = await fetch(url, { method: "GET", headers: headers })
        const resp = await res.json()
        const data = resp.activities
        console.log(data);
        if (data && data.length > 0) {
            let now = Math.floor(Date.now())
            for (let i = 0; i < data.length; i++) {
                if (txArr.indexOf(data[i].txId) == -1) {
                    if (data[i].kind == "offer_accepted_broadcasted" || data[i].kind == "coll_offer_fulfill_broadcasted") {
                        console.log('Found new Ordinals Dump');
                        let tokenId = data[i].tokenId
                        let price = Number(data[i].listedPrice / 100000000)
                        let from = data[i].oldOwner
                        let to = data[i].newOwner
                        let hash = data[i].txId
                        let img = `https://api.hiro.so/ordinals/v1/inscriptions/${tokenId}/content`
                        await buildOrdinalEmbeddedMessage(from, to, tokenId, price, hash, img)
                        txArr.push(data[i].txId)
                    }
                }
            }
        }
        await new Promise(resolve => setTimeout(resolve, 10000))
    }

}

const buildTensorEmbeddedMessage = async (from, to, id, amount, hash, img) => {
    try {
        const embedMessage = new EmbedBuilder()
            .setTitle("SOLANA DUMP NOTIFICATION")
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
            .setImage(img)
            .addFields(
                {
                    name: 'item',
                    value: `[${id}](https://www.tensor.trade/item/${id})`
                },
                {
                    name: 'from',
                    value: `[${from}](https://www.tensor.trade/portfolio?wallet=${from})`,
                    inline: false
                },
                {
                    name: 'to',
                    value: `[${to}](https://www.tensor.trade/portfolio?wallet=${to})`,
                    inline: false
                },
                {
                    name: 'price',
                    value: `${amount} SOL - [View Transaction](https://solscan.io/tx/${hash})`,
                    inline: false
                }
            )
        await discordClient.channels.cache.get(tensorChannelId).send({
            embeds: [embedMessage]
        })
    } catch (e) {
        console.log("Failed to embed message due to error: " + e.message);
    }
}

async function fetchTensorSellTx(txId, connection) {
    const tx = await connection.getParsedTransaction(
        txId,
        {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
        });

    // credits += 100;

    // console.log(tx);
    fs.writeFileSync('log2.json', JSON.stringify(tx, 2, 2))

    const accounts = tx?.transaction.message.instructions.find(ix => ix.programId.toBase58() === TENSOR_PUBLIC_KEY).accounts;
    // console.log(accounts);
    if (!accounts) {
        console.log("No accounts found in the transaction.");
        return;
    }

    const buyerIndex = 9;
    const sellerIndex = 10;
    const tokenIndex = 6;

    const buyer = accounts[buyerIndex].toBase58();
    const seller = accounts[sellerIndex].toBase58();
    const token = accounts[tokenIndex].toBase58();
    const postBal = tx?.meta.postBalances
    const preBal = tx?.meta.preBalances
    const hash = tx?.transaction.signatures[0]
    const img = await getNFTMetadata(token)
    let price = 0
    for (let i = 0; i < postBal.length; i++) {
        price = postBal[i] - preBal[i];
        if (price < 0) {
            price = Math.abs(price) / 1000000000;
            break;
        }
    }
    console.log(`Found NFT Dump:\nFrom: ${seller}\nTo: ${buyer}\nPrice: ${price} SOL`);
    if (price >= 1) {
        await buildTensorEmbeddedMessage(seller, buyer, token, price, hash, img)
    }
}

async function tensorTrack(connection, programAddress) {
    let txArr = []
    console.log("Monitoring logs for program:", programAddress.toString());
    connection.onLogs(
        programAddress,
        ({ logs, err, signature }) => {
            if (err) return;

            if (logs && logs.some(log => log.includes("SellNft"))) {
                if (txArr.indexOf(signature) == -1) {
                    txArr.push(signature)
                    console.log("Signature for 'SellNft':", signature);
                    try {
                        fetchTensorSellTx(signature, connection);
                    } catch (e) {
                        console.log(e);
                    }
                }
            }
        },
        "finalized"
    );
}

discordClient.on("ready", async () => {
    console.log(`Logged in as ${discordClient.user.tag}`)
    client.connect();
    osTrack()
    blurTrack721TakerFee()
    blurTrack721()
    magicEdenTrack()
    ordinalTrack()
    tensorTrack(connection, tensorSwap)
});

discordClient.login(botToken);

// handleBlurMessageFromTx("0x0debc87d6a1fbbfb75f93978805340a39207bc807930eb550f99e05e72ef9296")

// buildBlurEmbededMessage("0x1", "0x2", "0x3", "4", 0.5, "12sadsad34", )