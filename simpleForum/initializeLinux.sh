#!/bin/bash

rm -r -f db*

rm ~/.ssh/config

ssh-add -D

scp ~/.ssh/id_rsa.pub git@localhost:tai.pub

ssh git@localhost 'bash -s' < configure_server.sh
