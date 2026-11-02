FROM maven:3.9-eclipse-temurin-21
WORKDIR /app
COPY pom.xml ./
RUN mvn -q dependency:go-offline
COPY run.sh ./
COPY src ./src
# Compiles and runs the tests once at build time: Maven downloads everything "tests" will use
RUN mvn -q package
ENTRYPOINT ["sh", "run.sh"]
