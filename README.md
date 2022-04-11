# Auto rebake script For BakedBeans miner on BSC

## Setup

Edit the .env file to add your wallet address and private key

Run `npm install` and then edit the `package.json` scripts start section to the number of rebakes you'd like per day. By default it's set to 4 (every 6 hours).

e.g. change "node autoRebake.js 4" to "node autoRebake.js 3" would mean every 8 hours

Once you've saved you can then run the script by `npm start`

You can also skip all of that and run it manually via 

`node autoRebake.js 4`

I've also included heroku Procfile if you want the deploy it there (using a free dyno). This means you don't need to have the script running on your machine 24/7

Note if you do use heroku, if you'd like to change the default number of rebakes (4) you'll need to update the Procfile

If you like this please consider using my referral link, I'd really appreciate it

https://bakedbeans.io/?ref=0xCb7DCb16e7738C01BEf5F74AC727dE2da44AfD6F

Disclaimer: Note this is unaudited code and is not production ready for financial transactions