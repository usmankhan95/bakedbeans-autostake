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

const bbContractAddress = '0xe2d26507981a4daaaa8040bae1846c14e0fb56bf';
const provider = new ethers.providers.JsonRpcProvider(`https://bsc-dataseed.binance.org/`);
const wallet = new ethers.Wallet(process.env.bscPrivateKey, provider);

console.log('\nAdded wallet:', process.env.bscAddress)

// Define ABI's
const getContractBalAbi = ["function getBalance() public view returns(uint256)"];
const getMyMinersAbi = ["function getMyMiners(address adr) public view returns(uint256)"]
const getBeanRewardsAbi = ["function beanRewards(address adr) public view returns(uint256)"]
const hatchEggsAbi = ["function hatchEggs(address ref) public"]

// smart contract objects
const fetchBalanceContract = new ethers.Contract(bbContractAddress, getContractBalAbi, provider);
const fetchBeansContract = new ethers.Contract(bbContractAddress, getMyMinersAbi, provider);
const fetchRewardsContract = new ethers.Contract(bbContractAddress, getBeanRewardsAbi, provider);
const hatchEggsContract = new ethers.Contract(bbContractAddress, hatchEggsAbi, provider);

const rebakeInterval = 24 / args[0];
console.log('Set to rebake every', rebakeInterval, 'hour(s)\n')

async function rebake() {
    try {
        console.log('--REBAKING--')

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
        console.log('Successfully rebaked:', formattedRewards, 'BNB\n');

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

