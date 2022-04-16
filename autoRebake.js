import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { URL } from 'url';
import { createClient } from 'redis';
import { promisify } from 'util';

dotenv.config();

if (process.env.BSC_PRIVATE_KEY === 'YOUR_PRIVATE_KEY' || !process.env.BSC_PRIVATE_KEY) {

    throw 'Missing config. Add private key into env file!';
}

const bbContractAddress = '0xe2d26507981a4daaaa8040bae1846c14e0fb56bf';
const provider = new ethers.providers.JsonRpcProvider(`https://bsc-dataseed.binance.org/`);
const wallet = new ethers.Wallet(process.env.BSC_PRIVATE_KEY, provider);

console.log('\nAdded wallet:', wallet.address, '\n')

// Define ABI's
const getContractBalAbi = ["function getBalance() public view returns(uint256)"];
const getMyMinersAbi = ["function getMyMiners(address adr) public view returns(uint256)"]
const getBeanRewardsAbi = ["function beanRewards(address adr) public view returns(uint256)"]
const hatchEggsAbi = ["function hatchEggs(address ref) public"]
const sellEggsAbi = ["function sellEggs() public"]

// smart contract objects
const fetchBalanceContract = new ethers.Contract(bbContractAddress, getContractBalAbi, provider);
const fetchBeansContract = new ethers.Contract(bbContractAddress, getMyMinersAbi, provider);
const fetchRewardsContract = new ethers.Contract(bbContractAddress, getBeanRewardsAbi, provider);
const hatchEggsContract = new ethers.Contract(bbContractAddress, hatchEggsAbi, provider);
const sellEggsContract = new ethers.Contract(bbContractAddress, sellEggsAbi, provider);

// Init undefined redis objects
// We do this because we need these as global variables
// If the script is run in non redis mode, these are left undefined
let client = undefined;
let getAsync = undefined;
let setAsync = undefined;
const useRedis = process.env.REDISTOGO_URL ? true : false;

// running counts and metadata
let rebakeCount = 0;
let eatDayIntervalCount = 0;
let lastBakeTime = null;

// Initialise redis client
if (useRedis) {
    const rtg = new URL(process.env.REDISTOGO_URL);
    client = createClient(rtg.port, rtg.hostname, {
        no_ready_check: true
    });

    client.auth(rtg.password);

    client.on('error', (err) => console.error('Redis Client Error', err));

    getAsync = promisify(client.get).bind(client);
    setAsync = promisify(client.set).bind(client);
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
    console.log('Running BAKE', bakeDays, ': 1 EAT method')
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
        await getAsync("REBAKE_COUNT").then((reply) => {
            if (reply) {
                rebakeCount = reply;
            }
        });
    }

    return rebakeCount;
}

async function setRebakeCount(count) {
    if (useRedis) {
        await setAsync("REBAKE_COUNT", count);
    }

    rebakeCount = count;
}

async function getEatDayIntervalCount() {
    if (useRedis) {
        await getAsync("EAT_DAY_INTERVAL_COUNT").then((reply) => {
            if (reply) {
                eatDayIntervalCount = reply;
            }
        });
    }

    return eatDayIntervalCount;
}

async function setEatDayIntervalCount(count) {
    if (useRedis) {
        await setAsync("EAT_DAY_INTERVAL_COUNT", count);
    }

    eatDayIntervalCount = count;
}

async function getLastBakeTime() {
    if (useRedis) {
        await getAsync("LAST_BAKE_TIME").then((reply) => {
            if (reply) {
                lastBakeTime = reply;
            }
        });
    }

    return lastBakeTime;
}

async function setLastBakeTime(datetime) {
    if (useRedis) {
        await setAsync("LAST_BAKE_TIME", datetime);
    }

    lastBakeTime = datetime;
}

async function eatRewards() {
    try {
        console.log('\n--EATING BEANS--')

        const sellEggsSigned = sellEggsContract.connect(wallet);
        const tx = await sellEggsSigned.sellEggs();

        console.log('Eat beans successful.. resetting.')
        console.log('TX Hash:', tx.hash);
        console.log('TX Fee (Gas):', ethers.utils.formatEther(tx.gasLimit * tx.gasPrice), 'BNB\n')
    }
    catch (err) {
        console.error(err)
    }
}

async function run() {
    try {
        const currentRebakeCount = await getRebakeCount();
        const currentLastBakeTime = await getLastBakeTime();

        if (currentLastBakeTime) {
            console.log('Last bake time:', currentLastBakeTime)
        }

        const currentTime = new Date().toLocaleString()

        console.log('Current time:', currentTime, '\n')

        console.log('Rebake count:', currentRebakeCount)

        if (bakeDays) {
            console.log('Rebakes away from eat:', rebakesTillEat - currentRebakeCount)
        }

        const balance = await fetchBalanceContract.getBalance();
        console.log('BB Contract Balance:', parseFloat(ethers.utils.formatEther(balance)).toFixed(3), 'BNB');

        // fetch beans count
        const fetchBeansSigned = fetchBeansContract.connect(wallet);

        const preBakeBeanAmount = await fetchBeansSigned.getMyMiners(wallet.address);
        console.log('Your Beans (Pre bake):', preBakeBeanAmount.toString(), 'BEANS');

        // fetch running rewards
        const fetchRewardsSigned = fetchRewardsContract.connect(wallet);

        const rewards = await fetchRewardsSigned.beanRewards(wallet.address);
        const formattedRewards = parseFloat(ethers.utils.formatEther(rewards)).toFixed(3)
        console.log('BB Rewards:', formattedRewards, 'BNB');

        if (minRewardAmountToRebake && formattedRewards < minRewardAmountToRebake) {
            console.log('Rewards are currently lower than minimum desired amount. Skipping current rebake..')
            console.log('\nWaiting till next rebake in:', rebakeInterval, 'hour(s)')
            return;
        }

        if (bakeDays) {
            // checks if we've reached required number of rebakes before eat
            if (currentRebakeCount == rebakesTillEat) {
                console.log('\n--EAT DAY--')
                console.log('Checking if full day has passed..')
                const currentEatDayIntervalCount = getEatDayIntervalCount();
                // makes sure we get a full day of rewards before we eat
                if (rebakesPerDay == currentEatDayIntervalCount) {
                    await eatRewards();

                    // reset counts to 0 
                    await setRebakeCount(0);
                    await setEatDayIntervalCount(0);

                    console.log('Waiting till next rebake in:', rebakeInterval, 'hour(s)')
                    return;
                }

                console.log('Waiting to eat full day rewards..')
                console.log('Waiting till next interval in:', rebakeInterval, 'hour(s)')

                await setEatDayIntervalCount(Number(currentEatDayIntervalCount) + 1);
                return;
            }
        }

        // rebake beans (compound rewards)
        console.log('\n--REBAKING--')
        const hatchEggsSigned = hatchEggsContract.connect(wallet);

        const tx = await hatchEggsSigned.hatchEggs(wallet.address);
        await setLastBakeTime(currentTime);

        console.log('Successfully rebaked:', formattedRewards, 'BNB');
        console.log('TX Hash:', tx.hash);
        console.log('TX Fee (Gas):', ethers.utils.formatEther(tx.gasLimit * tx.gasPrice), 'BNB\n')

        await setRebakeCount(Number(currentRebakeCount) + 1);

        // waits here to allow the smart contract to update the miners value
        console.log('Waiting for beans to update...\n')
        await new Promise(r => setTimeout(r, 10000));

        const postBakeBeanAmount = await fetchBeansSigned.getMyMiners(wallet.address);
        console.log('Your Beans (Post bake):', postBakeBeanAmount.toString(), 'BEANS');

        console.log('\nWaiting till next rebake in:', rebakeInterval, 'hour(s)\n')
    }
    catch (err) {
        console.error('\nUnable to rebake. Error:', err, '\n');
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

