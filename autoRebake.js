import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const bbContractAddress = '0xe2d26507981a4daaaa8040bae1846c14e0fb56bf';
const provider = new ethers.providers.JsonRpcProvider(`https://bsc-dataseed.binance.org/`);
const wallet = new ethers.Wallet(process.env.bscPrivateKey, provider);

console.log('\nAdded wallet:', process.env.bscAddress)

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
const sellEggscontract = new ethers.Contract(bbContractAddress, sellEggsAbi, provider);

// running counts
let rebakeCount = 0;
let eatDayIntervalCount = 0;

// Minimum reward amount to rebake
const minRewardAmountToRebake = process.env.minRewardAmountToRebake;

if (minRewardAmountToRebake) {
    console.log('Rebaking only when rewards are above:', minRewardAmountToRebake, 'BNB')
}

// The number of days to rebake before eat day. 
// If not assigned, rebakes will continue indefinitely until script is stopped
const bakeDays = process.env.rebakeDays;

if (bakeDays) {
    console.log('Running BAKE', bakeDays, ': 1 EAT method')
} else {
    console.log('REBAKE ONLY MODE')
}

// The number of times per day to rebake
const rebakesPerDay = process.env.rebakesPerDay;

// The time interval between each rebake to reach the desired number of rebakes per day
const rebakeInterval = 24 / rebakesPerDay;

// Tracks how many rebakes are left till eat day
const rebakesTillEat = (bakeDays * 24) / rebakeInterval;

console.log('Set to rebake every', rebakeInterval, 'hour(s)\n')

async function eatRewards() {
    try {
        console.log('\n--EATING BEANS--')

        const sellEggsSigned = sellEggscontract.connect(wallet);
        await sellEggsSigned.sellEggs();

        console.log('Eat beans successful.. resetting.')
    }
    catch (err) {
        console.error(err)
    }
}

async function rebake() {
    try {
        console.log('Rebake count:', rebakeCount)

        if (bakeDays) {
            console.log('Rebakes away from eat:', rebakesTillEat - rebakeCount)
        }

        let balance = await fetchBalanceContract.getBalance();
        console.log('BB Contract Balance:', parseFloat(ethers.utils.formatEther(balance)).toFixed(3), 'BNB');

        // fetch beans count
        const fetchBeansSigned = fetchBeansContract.connect(wallet);

        let beans = await fetchBeansSigned.getMyMiners(process.env.bscAddress);
        console.log('Your Beans:', beans.toString(), 'BEANS');

        // fetch running rewards
        const fetchRewardsSigned = fetchRewardsContract.connect(wallet);

        let rewards = await fetchRewardsSigned.beanRewards(process.env.bscAddress);
        let formattedRewards = parseFloat(ethers.utils.formatEther(rewards)).toFixed(3)
        console.log('BB Rewards:', formattedRewards, 'BNB');

        if (minRewardAmountToRebake && formattedRewards < minRewardAmountToRebake) {
            console.log('Rewards are currently lower than minimum desired amount. Skipping current rebake..')
            console.log('Waiting till next rebake in:', rebakeInterval, 'hour(s)')
            return;
        }

        if (bakeDays) {
            // checks if we've reached required number of rebakes before eat
            if (rebakeCount === rebakesTillEat) {
                console.log('\n--EAT DAY--')
                console.log('Checking if full day has passed..')
                // makes sure we get a full day of rewards before we eat
                if (rebakesPerDay == eatDayIntervalCount) {
                    await eatRewards();
                    rebakeCount = 0;
                    eatDayIntervalCount = 0;

                    console.log('Waiting till next rebake in:', rebakeInterval, 'hour(s)')
                    return;
                }

                console.log('Waiting to eat full day rewards..')
                console.log('Waiting till next interval in:', rebakeInterval, 'hour(s)')
                eatDayIntervalCount++;
                return;
            }
        }

        // rebake beans (compound rewards)
        console.log('\n--REBAKING--')
        const hatchEggsSigned = hatchEggsContract.connect(wallet);

        await hatchEggsSigned.hatchEggs(process.env.bscAddress);
        console.log('Successfully rebaked:', formattedRewards, 'BNB\n');
        rebakeCount++;

        console.log('Waiting till next rebake in:', rebakeInterval, 'hour(s)')
    }
    catch (err) {
        console.error('Unable to rebake. Error:', err);
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

