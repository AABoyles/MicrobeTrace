#!/bin/sh
# Removes the compressed copies gzipper makes (compress.sh). Run from the repository root.
set -eu
cd "$(dirname "$0")/.."

echo 'Removing Compressed Files...'

# -f: a directory with nothing compressed in it is not an error
rm -f components/*.br components/*.gz
rm -f data/*.br data/*.gz
rm -f dist/*.br dist/*.gz
rm -f vendor/*.br vendor/*.gz
rm -f workers/*.br workers/*.gz
