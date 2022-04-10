import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

var args = process.argv.slice(2)

if (args.count === 0 || isNaN(args[0])) {
    throw {
        name: 'Incorrect arguments',
        message: 'Add number of compounds required'
    }
}

const provider = new ethers.providers.JsonRpcProvider(`https://bsc-dataseed.binance.org/`);
const wallet = new ethers.Wallet(process.env.bscPrivateKey, provider);
console.log('Added wallet:', process.env.bscAddress)

// Define ABI's
const getContractBalAbi = ["function getBalance() public view returns(uint256)"];
const getMyMinersAbi = ["function getMyMiners(address adr) public view returns(uint256)"]
const getBeanRewardsAbi = ["function beanRewards(address adr) public view returns(uint256)"]
const hatchEggsAbi = ["function hatchEggs(address ref) public"]

// smart contract objects
const fetchBalanceContract = new ethers.Contract(process.env.bakedBeansContractAddress, getContractBalAbi, provider);
const fetchBeansContract = new ethers.Contract(process.env.bakedBeansContractAddress, getMyMinersAbi, provider);
const fetchRewardsContract = new ethers.Contract(process.env.bakedBeansContractAddress, getBeanRewardsAbi, provider);
const hatchEggsContract = new ethers.Contract(process.env.bakedBeansContractAddress, hatchEggsAbi, provider);

const rebakesRequestedPerDay = 24 / args[0];

console.log('Set to rebake every', rebakesRequestedPerDay, 'hour(s)')

const POLLING_INTERVAL = hoursToMiliseconds(rebakesRequestedPerDay)
setIntervalAsync(async () => { await rebake() }, POLLING_INTERVAL)

async function rebake() {
    try {
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

        // rebake beans (compound rewards)
        const hatchEggsSigned = hatchEggsContract.connect(wallet);

        await hatchEggsSigned.hatchEggs(process.env.bscAddress);
        console.log('Successfully rebaked:', formattedRewards, 'BNB');
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

