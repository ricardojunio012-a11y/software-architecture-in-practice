FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir pytest==8.4.1 import-linter==2.13
COPY run.sh importlinter-before.ini importlinter-after.ini ./
COPY morada ./morada
COPY tests ./tests
ENTRYPOINT ["sh", "run.sh"]
