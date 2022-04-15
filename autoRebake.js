import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { URL } from 'url';
import { createClient } from 'redis';

dotenv.config();

const bbContractAddress = '0xe2d26507981a4daaaa8040bae1846c14e0fb56bf';
const provider = new ethers.providers.JsonRpcProvider(`https://bsc-dataseed.binance.org/`);
const wallet = new ethers.Wallet(process.env.BSC_PRIVATE_KEY, provider);

console.log('\nAdded wallet:', process.env.BSC_ADDRESS, '\n')

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

// Init redis default client
// We do this because we need a global client variable
// If the script is run without redis it poses no issues and is left unused
let client = createClient();
const useRedis = process.env.REDISTOGO_URL ? true : false;

// running counts and metadata
let rebakeCount = 0;
let eatDayIntervalCount = 0;
let lastBakeTime = null;

// Initialise redis values
if (useRedis) {
    //var rtg = url.parse(process.env.REDISTOGO_URL);
    var rtg = new URL(process.env.REDISTOGO_URL);
    client = createClient(rtg.port, rtg.hostname);
    client.auth(rtg.password);

    client.on('error', (err) => console.log('Redis Client Error', err));

    await client.connect();

    var cachedRebakeCount = await client.get('REBAKE_COUNT')

    if (cachedRebakeCount) {
        rebakeCount = cachedRebakeCount;
    }

    var cachedEatDayIntervalCount = await client.get('EAT_DAY_INTERVAL_COUNT')

    if (cachedEatDayIntervalCount) {
        eatDayIntervalCount = cachedEatDayIntervalCount;
    }

    var cachedlastBakeTime = await client.get('LAST_BAKE_TIME')

    if (cachedlastBakeTime) {
        lastBakeTime = cachedlastBakeTime;
    }
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
        return await client.get('REBAKE_COUNT');
    }

    return rebakeCount;
}

async function setRebakeCount(count) {
    if (useRedis) {
        await client.set('REBAKE_COUNT', count);
    }

    rebakeCount = count;
}

async function getEatDayIntervalCount() {
    if (useRedis) {
        return await client.get('EAT_DAY_INTERVAL_COUNT');
    }

    return eatDayIntervalCount;
}

async function setEatDayIntervalCount(count) {
    if (useRedis) {
        await client.set('EAT_DAY_INTERVAL_COUNT', count);
    }

    eatDayIntervalCount = count;
}

async function getLastBakeTime() {
    if (useRedis) {
        return await client.get('LAST_BAKE_TIME');
    }

    return lastBakeTime;
}

async function setLastBakeTime(datetime) {
    if (useRedis) {
        await client.set('LAST_BAKE_TIME', datetime);
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

async function rebake() {
    try {
        const currentRebakeCount = await getRebakeCount();
        const currentLastBakeTime = await getLastBakeTime();

        if (currentLastBakeTime) {
            console.log('Last bake time:', currentLastBakeTime)
        }

        console.log('Current time:', new Date().toLocaleString(), '\n')

        console.log('Rebake count:', currentRebakeCount)

        if (bakeDays) {
            console.log('Rebakes away from eat:', rebakesTillEat - currentRebakeCount)
        }

        const balance = await fetchBalanceContract.getBalance();
        console.log('BB Contract Balance:', parseFloat(ethers.utils.formatEther(balance)).toFixed(3), 'BNB');

        // fetch beans count
        const fetchBeansSigned = fetchBeansContract.connect(wallet);

        const preBakeBeanAmount = await fetchBeansSigned.getMyMiners(process.env.BSC_ADDRESS);
        console.log('Your Beans (Pre bake):', preBakeBeanAmount.toString(), 'BEANS');

        // fetch running rewards
        const fetchRewardsSigned = fetchRewardsContract.connect(wallet);

        const rewards = await fetchRewardsSigned.beanRewards(process.env.BSC_ADDRESS);
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
                const currentEatDayIntervalCount = await getEatDayIntervalCount();
                // makes sure we get a full day of rewards before we eat
                if (rebakesPerDay == currentEatDayIntervalCount) {
                    await eatRewards();
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

        const tx = await hatchEggsSigned.hatchEggs(process.env.BSC_ADDRESS);
        await setLastBakeTime(new Date().toLocaleString());

        console.log('Successfully rebaked:', formattedRewards, 'BNB');
        console.log('TX Hash:', tx.hash);
        console.log('TX Fee (Gas):', ethers.utils.formatEther(tx.gasLimit * tx.gasPrice), 'BNB\n')

        await setRebakeCount(Number(currentRebakeCount) + 1);

        // waits 5 seconds here to allow the smart contract to update the miners value
        console.log('Waiting for beans to update...\n')
        await new Promise(r => setTimeout(r, 10000));

        const postBakeBeanAmount = await fetchBeansSigned.getMyMiners(process.env.BSC_ADDRESS);
        console.log('Your Beans (Post bake):', postBakeBeanAmount.toString(), 'BEANS');

        console.log('\nWaiting till next rebake in:', rebakeInterval, 'hour(s)')
    }
    catch (err) {
        console.error('\nUnable to rebake. Error:', err);
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
setIntervalAsync(async () => { await rebake() }, POLLING_INTERVAL)

