#!/bin/bash

rm -r -f projects.list repositories/ .ssh/authorized_keys .gitolite.rc .gitolite/

mkdir -p ~/bin

gitolite/install -ln ~/bin
bin/gitolite setup -pk tai.pub

cat tai.pub >> .ssh/authorized_keys

rm tai.pub
