#!/usr/bin/env sh
# Compile and run the backend with just a JDK (Java 21+). The React app is already built into backend/src/main/resources/public.
set -e
cd "$(dirname "$0")/backend"
rm -rf out && mkdir -p out
javac -d out $(find src/main/java -name '*.java')
echo "Compiled. Starting on http://127.0.0.1:${PORT:-8080}  (admin console: /admin)"
exec java -cp out:src/main/resources setu.Main
