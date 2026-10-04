#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/env-runner"
mvn -q clean package -DskipTests
echo "built: $(ls -la target/rl-runner.jar | awk '{print $6, $7, $8}')"
