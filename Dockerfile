# Kisan Setu: Java 21 backend + prebuilt React app in one small image. Data must live on a persistent volume at /data.
# (Not built by the author: Docker was not available in the build sandbox.)
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY backend ./backend
RUN mkdir -p /out && javac -d /out $(find backend/src/main/java -name '*.java')

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /out ./classes
COPY backend/src/main/resources ./resources
ENV HOST=0.0.0.0 PORT=8080 KS_DATA=/data
VOLUME /data
EXPOSE 8080
CMD ["java", "-cp", "classes:resources", "setu.Main"]
