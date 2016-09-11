#!/bin/bash

rm -r -f db*

rm /home/tailiu/.ssh/config

ssh git@localhost 'bash -s' < configure_server.sh
