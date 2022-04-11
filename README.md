# Auto rebake script For BakedBeans miner on BSC

## Setup

Edit the .env file to add your wallet address and private key
The .env file contains the following arguments

### Mandatory:
- `bscAddress`
    - Your wallet address
- `bscPrivateKey`
    - The private key for that wallet
- `rebakesPerDay` (default set to 4)
    - The number of times to rebake (compound) in 24 hours

### Optional:
- `rebakeDays` (default set to 6)
    - If not empty, will rebake for 6 days and eat on the 7th (After a full 24 hours for maximum reward)
- `minRewardAmountToRebake` (default set to 0.01)
    - Won't rebake if the current reward amount is lower than this value


Run `npm install` and then `npm start` or `node autoRebake.js`


I've also included a heroku Procfile if you want the deploy it there (using a free dyno). This means you don't need to have the script running on your machine 24/7

When running through heroku, don't deploy your private key or any of the env files. Use the config vars section in heroku to access these variables. You'll need to manually add the config vars yourself. 

Also make sure you are using a worker dyno and switch of the default web dyno.

If you like this please consider using my referral link, I'd really appreciate it

https://bakedbeans.io/?ref=0xCb7DCb16e7738C01BEf5F74AC727dE2da44AfD6F

Disclaimer: Note this is unaudited code and is not production ready for financial transactions
