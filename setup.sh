#! /bin/bash

read -r line < .env

# if [[ "${line:16}" == "YOUR_PRIVATE_KEY"* ]]; then
#     echo "Missing private key from .env file. Add the key and any configurations then restart this setup."
#     read -p "Press enter key to exit.."
#     exit
# fi

# if [which node > /dev/null]; then
#     echo "node is installed, skipping..."
# else
#     # add deb.nodesource repo commands 
#     # install node
# fi

if ! command node -v &> /dev/null
then
    echo "Node could not be found"
    read -p "Press enter key to install..."
    sudo apt update && sudo apt install -y nodejs
else
    echo "Node already installed.. Continuing"
fi

file="autoRebake.js"

if [ -f "$file" ] ; then
    echo "Found existing file, removing..."
    rm "$file"
fi

command npm run package
echo "Successfully setup auto rebake app..."
read -p "Press enter key to finish..."