#!/bin/bash

rm -r -f db*

rm /home/tailiu/.ssh/config

scp ~/.ssh/id_rsa.pub git@localhost:tai.pub

ssh git@localhost 'bash -s' < configure_server.sh
