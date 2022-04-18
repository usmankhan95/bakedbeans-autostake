import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { URL } from 'url';
import { createClient } from 'redis';
import { promisify } from 'util';
import { abi } from "./abi.js";
import Conf from 'conf';

dotenv.config();
const localStore = new Conf();

if (process.env.BSC_PRIVATE_KEY === 'YOUR_PRIVATE_KEY' || !process.env.BSC_PRIVATE_KEY) {

    throw 'Missing config. Add private key into env file!';
}

const bbContractAddress = '0xe2d26507981a4daaaa8040bae1846c14e0fb56bf';
const provider = new ethers.providers.JsonRpcProvider(`https://bsc-dataseed.binance.org/`);
const wallet = new ethers.Wallet(process.env.BSC_PRIVATE_KEY, provider);
const bscScan = 'https://www.bscscan.com/tx/';

console.log('\nAdded wallet:', wallet.address, '\n')

// Smart contract
const contract = new ethers.Contract(bbContractAddress, abi, provider);
const signedContract = contract.connect(wallet);

// Declare undefined objects
// We do this to mitigate block scoping as the values aren't hoisted in the if block below
let redisStore = undefined;
let getAsync = undefined;
let setAsync = undefined;
let delAsync = undefined;

const useRedis = process.env.REDISTOGO_URL ? true : false;

// Running counts and metadata
let rebakeCount = 0;
let eatDayStartTime = null;
let lastBakeTime = null;
let currentTime = null;

const REBAKE_COUNT = "REBAKE_COUNT";
const EAT_DAY_START_TIME = "EAT_DAY_START_TIME";
const LAST_BAKE_TIME = "LAST_BAKE_TIME";

// Initialises redis
if (useRedis) {
    const rtg = new URL(process.env.REDISTOGO_URL);
    redisStore = createClient(rtg.port, rtg.hostname, {
        no_ready_check: true
    });

    redisStore.auth(rtg.password);

    redisStore.on('error', (err) => console.error('Redis Client Error', err));

    getAsync = promisify(redisStore.get).bind(redisStore);
    setAsync = promisify(redisStore.set).bind(redisStore);
    delAsync = promisify(redisStore.del).bind(redisStore);
}

// Minimum reward amount to rebake
const minRewardAmountToRebake = process.env.MIN_REWARD_AMOUNT_TO_REBAKE;

if (minRewardAmountToRebake) {
    console.log('Rebaking only when rewards are above:', minRewardAmountToRebake, 'BNB')
}

// The number of days to rebake before eat day. 
// If not assigned, rebakes will continue indefinitely until script is stopped
const bakeDays = process.env.REBAKE_DAYS;

if (bakeDays) {
    console.log(`Running BAKE ${bakeDays}:1 EAT method`)
} else {
    console.log('REBAKE ONLY MODE')
}

// The number of times per day to rebake
const rebakesPerDay = process.env.REBAKES_PER_DAY;

// The time interval between each rebake to reach the desired number of rebakes per day
const rebakeInterval = 24 / rebakesPerDay;

// Tracks how many rebakes are left till eat day
const rebakesTillEat = (bakeDays * 24) / rebakeInterval;

console.log('Set to rebake every', rebakeInterval, 'hour(s)\n')

async function getRebakeCount() {
    if (useRedis) {
        let foundReply = false;
        await getAsync(REBAKE_COUNT).then((reply) => {
            // check if value exists in redis first, return here if value found
            if (reply) {
                rebakeCount = reply;
                foundReply = true;
            }
        });

        if (foundReply) {
            return rebakeCount;
        }
    }
    // Checks local store on disk for value 
    const val = localStore.get(REBAKE_COUNT);
    if (val) {
        rebakeCount = val;
    }

    return rebakeCount;
}

async function getEatDayStartTime() {
    if (useRedis) {
        let foundReply = false;
        await getAsync(EAT_DAY_START_TIME).then((reply) => {
            if (reply) {
                eatDayStartTime = reply;
                foundReply = true;
            }
        });

        if (foundReply) {
            return new Date(eatDayStartTime);
        }
    }

    const val = localStore.get(EAT_DAY_START_TIME);
    if (val) {
        eatDayStartTime = new Date(val);
    }

    return eatDayStartTime;
}

async function getLastBakeTime() {
    if (useRedis) {
        let foundReply = false;
        await getAsync(LAST_BAKE_TIME).then((reply) => {
            if (reply) {
                lastBakeTime = new Date(reply);
                foundReply = true;
            }
        });

        if (foundReply) {
            return lastBakeTime;
        }
    }

    const val = localStore.get(LAST_BAKE_TIME);
    if (val) {
        lastBakeTime = new Date(val);
    }

    return lastBakeTime;
}

async function setRebakeCount(count) {
    if (useRedis) {
        await setAsync(REBAKE_COUNT, count);
    }

    localStore.set(REBAKE_COUNT, count);
    rebakeCount = count;
}

async function setEatDayStartTime(datetime) {

    var storedVal = await getEatDayStartTime();

    if (storedVal) {
        if (datetime) {
            return;
        }
    }

    if (useRedis) {
        if (datetime) {
            await setAsync(EAT_DAY_START_TIME, datetime);
        } else {
            await delAsync(EAT_DAY_START_TIME);
        }
    }

    localStore.set(EAT_DAY_START_TIME, datetime);
    eatDayStartTime = datetime;
}

async function setLastBakeTime(datetime) {
    if (useRedis) {
        await setAsync(LAST_BAKE_TIME, datetime);
    }

    localStore.set(LAST_BAKE_TIME, datetime);
    lastBakeTime = datetime;
}

async function eat() {
    try {
        console.log('\n--EATING BEANS--')

        const tx = await signedContract.sellEggs();

        console.log('Eat beans successful.. resetting.')
        console.log(`BscScan: ${bscScan}${tx.hash}`)
        console.log('TX Hash:', tx.hash);
        console.log('TX Fee (Gas):', ethers.utils.formatEther(tx.gasLimit * tx.gasPrice), 'BNB\n')
    }
    catch (err) {
        console.error(err)
    }
}

async function rebake(rewards) {
    if (lastBakeTime) {
        const timeDelta = (Math.abs(lastBakeTime - currentTime) / 36e5);
        // Allows (0.1) of cushion
        if ((rebakeInterval - timeDelta) >= 0.1) {
            console.log('\nRebake interval of', rebakeInterval, 'hour(s) not reached');
            return false;
        }
    }

    // Rebake beans (compound rewards)
    console.log('\n--REBAKING--')

    const tx = await signedContract.hatchEggs(wallet.address);
    await setLastBakeTime(currentTime);

    console.log('Successfully rebaked:', rewards, 'BNB');
    console.log(`BscScan: ${bscScan}${tx.hash}`)
    console.log('TX Hash:', tx.hash);
    console.log('TX Fee (Gas):', ethers.utils.formatEther(tx.gasLimit * tx.gasPrice), 'BNB\n')

    await setRebakeCount(Number(await getRebakeCount()) + 1);

    // Waits here to allow the smart contract to update the miners value
    console.log('Waiting for beans to update...\n')
    await new Promise(r => setTimeout(r, 10000));

    const postBakeBeanAmount = await contract.getMyMiners(wallet.address);

    console.log('Your Beans (Post bake):', postBakeBeanAmount.toString(), 'BEANS');

    return true;
}

async function run() {
    try {
        const currentRebakeCount = await getRebakeCount();
        const currentLastBakeTime = await getLastBakeTime();

        if (currentLastBakeTime) {
            console.log('Last bake time:', currentLastBakeTime)
        }

        currentTime = new Date();

        console.log('Current time:', currentTime, '\n')

        console.log('Rebake count:', currentRebakeCount)

        if (bakeDays) {
            console.log('Rebakes away from eat:', rebakesTillEat - currentRebakeCount)
        }

        const balance = await contract.getBalance();
        console.log('BB Contract Balance:', parseFloat(ethers.utils.formatEther(balance)).toFixed(3), 'BNB');

        // Fetch beans count
        const preBakeBeanAmount = await contract.getMyMiners(wallet.address);
        console.log('Your Beans (Pre bake):', preBakeBeanAmount.toString(), 'BEANS');

        // Fetch running rewards
        const rewards = await contract.beanRewards(wallet.address);
        const formattedRewards = parseFloat(ethers.utils.formatEther(rewards)).toFixed(3)
        console.log('BB Rewards:', formattedRewards, 'BNB');

        if (minRewardAmountToRebake && formattedRewards < minRewardAmountToRebake) {
            console.log('Rewards are currently lower than minimum desired amount. Skipping current rebake..')
            console.log('\nWaiting till next rebake in:', rebakeInterval, 'hour(s)')
            return;
        }

        if (bakeDays) {
            // Checks if we've reached required number of rebakes before eat
            if (currentRebakeCount == rebakesTillEat) {
                console.log('\n--EAT DAY--')
                // Sets initial eat day start time
                // Wont set start time again until next EAT DAY
                await setEatDayStartTime(currentTime);

                console.log('Checking if full day has passed..')
                const eatDayStartTime = await getEatDayStartTime();

                // 36e5 is scientific notation for 60 * 60 * 1000 (36*10^5)
                const timeDelta = (Math.abs(eatDayStartTime - currentTime) / 36e5);

                // Makes sure we get a full day of rewards before we eat
                // Allows 30 mins (0.5) of cushion
                if (timeDelta >= 23.5) {
                    await eat();

                    // Reset metadata
                    await setRebakeCount(0);
                    await setEatDayStartTime(null);

                    console.log('Waiting till next rebake in:', rebakeInterval, 'hour(s)');
                    return;
                }

                console.log('Full day not reached..');
                console.log('Will check again in:', rebakeInterval, 'hour(s)');

                return;
            }
        }

        const result = await rebake(formattedRewards);

        if (result) {
            console.log('\nWaiting till next rebake in:', rebakeInterval, 'hour(s)\n');
        } else {
            console.log('Skipping current rebake..');
            console.log('\nWaiting till next rebake in:', rebakeInterval, 'hour(s)\n');
        }
    }
    catch (err) {
        console.error('\nUnable to rebake. Error:', err, '\n');
        console.log('Skipping current rebake..');
        console.log('Waiting till next rebake in:', rebakeInterval, 'hour(s)\n');
    }
}

function hoursToMiliseconds(hrs) {
    return hrs * 60 * 60 * 1000;
}

const setIntervalAsync = (fn, ms) => {
    fn().then(() => {
        setTimeout(() => setIntervalAsync(fn, ms), ms);
    });
};

const POLLING_INTERVAL = hoursToMiliseconds(rebakeInterval)
setIntervalAsync(async () => { await run() }, POLLING_INTERVAL)

