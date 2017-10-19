# Test-Assets-Dataset

![](http://dashif.org/wp-content/uploads/2014/12/dashif-logo-283x100.jpg)

## Introduction

The DASH-IF Testvector database is a tool to allow a dynamic management of the testvectors provided by the DASH Industry Forum. This includes:

- Categorized DASH-IF features and feature groups
- Test cases for the individual features.
- Test vectors for the test cases.
- Dynamic management of the attributes all the models

A live demo of the tool can be found [here](http://testassets.dashif.org/) . This repository provides the server-side functionality of the tool.
It is supposed to run alongside the [Test-Assets-UI](https://github.com/Dash-Industry-Forum/Test-Assets-UI-public).

##Architecture

![](https://github.com/Dash-Industry-Forum/Test-Assets-Dataset-Public/blob/master/doc/diagrams/dashif-test-assets-dataset-architecture.png)


![](https://github.com/Dash-Industry-Forum/Test-Assets-Dataset-Public/blob/master/doc/diagrams/dashif-test-assets-dataset-rest-api-architecture.png)


## Installation

Backend System consists of two parts

1. MongoDB Database  
2. REST API Server  

### Setting up MongoDB  

MongoDB >= 3.2.x is required.

Follow instruction on how to [Install MongoDB Community Edition on Ubuntu](https://docs.mongodb.com/v3.2/tutorial/install-mongodb-on-ubuntu/).  

We recommend free and open source [native and cross-platform MongoDB manager](https://robomongo.org/)


### Setting up REST API Server

Our current system is installed on Ubuntu Server 14.04 LTS (HVM)

1. Setup NodeJS v4.x
2. Download REST API Source code.
3. Install dependency. 
4. Configuring Database access.
5. Launch REST API Server. (TBD)

#### Setup NodeJS v4.x

Follow instruction on how to install [NodeJS v4.x](https://github.com/nodesource/distributions#deb)

    # Using Ubuntu
    curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -  
    sudo apt-get install -y nodejs  

Then we set up a package root in homedir to hold the NodeJS "global" packages:

#### Configure `homedir` for NodeJS "global" pacakges

    $ NPM_PACKAGES="$HOME/.npm-packages"
    $ mkdir -p "$NPM_PACKAGES"

Set NPM to use this directory for its global package installs:

    $ echo "prefix = $NPM_PACKAGES" >> ~/.npmrc

Configure your PATH and MANPATH to see commands in your $NPM_PACKAGES prefix by adding the following to your .zshrc/.bashrc:

    # NPM packages in homedir
    NPM_PACKAGES="$HOME/.npm-packages"

    # Tell our environment about user-installed node tools
    PATH="$NPM_PACKAGES/bin:$PATH"
    
    # Unset manpath so we can inherit from /etc/manpath via the `manpath` command
    unset MANPATH  # delete if you already modified MANPATH elsewhere in your configuration
    MANPATH="$NPM_PACKAGES/share/man:$(manpath)"

    # Tell Node about these packages
    NODE_PATH="$NPM_PACKAGES/lib/node_modules:$NODE_PATH"

#### Download REST API Source code

You can add your server SSH Key to git for authentication by following [adding a new SSH key to your GitHub account](https://help.github.com/articles/adding-a-new-ssh-key-to-your-github-account/) instruction.

Choose your own method [how to obtain source code] (https://help.github.com/articles/which-remote-url-should-i-use/). In our example we cloning using HTTPs method

    $ git clone https://github.com/Dash-Industry-Forum/Test-Assets-Dataset-Public.git
    $ cd Test-Assets-Dataset
    $ npm install

You could also download ZIP Archive https://github.com/Dash-Industry-Forum/Test-Assets-Dataset/archive/master.zip 

    $ unzip master.zip
    $ cd Test-Assets-Dataset-master
    $ npm install

#### Configuring Database access

The `config` directory contains config files for different `NODE_ENV` settings. By default the values from the `default.json` are used. 
In order to setup the database parameters change the values in `dbConfig`. Please follow the instructions on the MongoDB [documentation](https://docs.mongodb.com/manual/tutorial/enable-authentication/) to create the respective users for your database.
Also keep in mind to start the MongoDB with authorization turned on:
`mongod --auth` 
#### C++ bson extension

Find in npm module mongodb ..node_modules\mongodb\node_modules\bson\ext\index.js

and change path to js version in catch block

    bson = require('../build/Release/bson');
to   
    
    bson = require('../browser_build/bson');

#### Launch REST API Server.

Install the dependencies

    npm install

If this is a new setup you need to add a superuser.

    cd datasets
    node create_user.js
    
Afterwards you can run the API Server by typing:

    npm start
    
In order to change the port adjust the `webConfig.port` parameter in your config file.
Now you can login with the superuser and add additional users if necessary.
    
