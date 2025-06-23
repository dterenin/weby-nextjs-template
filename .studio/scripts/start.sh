#!/bin/bash
set -e

ls -al .

if [ ! -e "node_modules" ]; then
    ln -s ../node_modules ./node_modules
fi

if [ ! -e ".next" ]; then
    ln -s ../.next ./.next
fi

START=$(date +%s);
echo "Starting fix"
npm run fix
END=$(date +%s);

printf "\nElapsed:\n"
echo $((END-START)) | awk '{print int($1/60)":"int($1%60)}'

echo "Starting install-deps"
npm run install-deps
END=$(date +%s);

printf "\nElapsed:\n"
echo $((END-START)) | awk '{print int($1/60)":"int($1%60)}'

echo "Starting lint"
npm run lint
END=$(date +%s);

printf "\nElapsed:\n"
echo $((END-START)) | awk '{print int($1/60)":"int($1%60)}'

echo "Starting format"
npm run format > /dev/null 2>&1
END=$(date +%s);

printf "\nElapsed:\n"
echo $((END-START)) | awk '{print int($1/60)":"int($1%60)}'

echo "Starting build"
npm run build
END=$(date +%s);

printf "\nElapsed:\n"
echo $((END-START)) | awk '{print int($1/60)":"int($1%60)}'

echo "Starting start"
npm run start
