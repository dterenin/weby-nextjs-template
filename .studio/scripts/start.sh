#!/bin/bash
set -e

START=$(date +%s);
echo "Starting fix"
npm run fix
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

echo "Starting Next.js dev server..."
npm run dev &
DEV_PID=$!

echo "Waiting for server to be ready..."
while ! curl -s http://localhost:8080 > /dev/null 2>&1; do
    sleep 0.5
    done

END=$(date +%s)
echo "✅ Server ready at http://localhost:8080 in $((END-START))s total"

wait $DEV_PID