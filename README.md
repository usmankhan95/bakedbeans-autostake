# Auto rebake script For BakedBeans miner on BSC

## Background

I write code for a living and have worked in the finance space for the past 4 years. I wrote this bot because I live a busy schedule and if anything in the tech world requires simple repetitive actions, it can always be automated. The baked beans project recommends to rebake (compound) every day and then on the 7th you can "eat" to claim back rewards. 

This script has been written to automate that whole process with the ability to configure the variables to tweak the scripts behaviour. For example, the default behaviour will rebake 4 times a day (REBAKES_PER_DAY) for 6 days (REBAKE_DAYS). After it's reached the required REBAKE_DAYS, it will enter "EAT DAY" and then wait 24 hours to eat (It does this to make sure we get the maximum reward from the day). It will then reset all the counters and restart the cycle. 

Even though this script is labelled BakedBeans miner, it can be trivially adapted to automate many other miner dApps and BakedBeans forks. This would require code changes and replacing the smart contract calls to the desired projects functions.

## Setup

Edit the .env file to add your wallet address and private key

> It is necessary to add your wallets private key as this script works directly with the smart contract and would need to make transactions with your wallet i.e. rebaking and eating. This script is unlike other "auto" bots in that it doesn't require your browser to be open.

The .env file contains the following arguments

### Mandatory:
- `BSC_ADDRESS`
    - Your wallet address
- `BSC_PRIVATE_KEY`
    - The private key for that wallet
- `REBAKES_PER_DAY` (default set to 4)
    - The number of times to rebake (compound) in 24 hours

### Optional:
- `REBAKE_DAYS` (default set to 6)
    - Rebakes for `n` days and eats on `n+1` (After a full 24 hours for maximum reward). If not set, the script will continue to rebake indefinitely. 
- `MIN_REWARD_AMOUNT_TO_REBAKE` (default set to 0.01)
    - Won't rebake if the current reward amount is lower than this value


## Running the script

### <ins>Local or VPS</ins>

Prerequisite: 
- Installed [node](https://nodejs.org/en/download/)

You can run the script from your machine with the command:

`npm start` or `node autoRebake.js`

The script will run fine this way but just note that the machine will need to be on 24/7 as the running counts aren't persisted anywhere. This shouldn't be too much of an issue if running on a VPS.

### <ins>Deploy to Heroku - FREE</ins>

You'll need to make an account on Heroku and create a new app. You can call this anything, mine is called `bakedbeans-autostake`. Then fork this repo and hook it up to Heroku.

I've included a heroku Procfile that selects the correct worker dyno. This means you don't need to have the script running on your machine 24/7 as Heroku will host the script on their containers.

With the sensitivity of the data being added to the .env file. Since we're deploying it to Heroku, don't add your values in the .env file. In this case you'll want to add all the .env file keys to the [Config vars](https://devcenter.heroku.com/articles/config-vars) section in Heroku. Heroku encrypts this so it's safe to keep confidential data here.

> Note: Make sure you are using the worker dyno and switch of the default web dyno.

The way Heroku works, it recycles dynos every 24 hours, which obviously is not ideal as we need to keep track of how many rebakes we're up to etc. To work past this, I've added redis support into the script. All you need to do is enable the add-on in Heroku for [Redis To Go](https://elements.heroku.com/addons/redistogo) and choose the Nano price plan which is free. Once added you're all set.

If you like this please consider using my referral link, I'd really appreciate it

https://bakedbeans.io/?ref=0xCb7DCb16e7738C01BEf5F74AC727dE2da44AfD6F

Disclaimer: Note this is unaudited code and is not production ready for financial transactions.
