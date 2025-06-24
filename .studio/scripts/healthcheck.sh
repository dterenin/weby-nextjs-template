#!/bin/bash
curl -sS --max-time 3 -o /dev/null http://localhost:8080/ || exit 1
