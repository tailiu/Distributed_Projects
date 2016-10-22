#!/bin/bash

if [ "$1" == "" ]
then
    echo "Please input key name"
    exit
fi

mkdir -p ~/bin

git clone git://github.com/sitaramc/gitolite
gitolite/install -ln ~/bin
gitolite setup -pk $1