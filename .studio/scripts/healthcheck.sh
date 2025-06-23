#!/bin/bash
curl -sS --max-time 3 -o /dev/null http://localhost:3000/ || exit 1
