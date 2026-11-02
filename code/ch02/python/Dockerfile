FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir pytest==8.4.1
COPY run.sh ./
COPY morada ./morada
COPY tests ./tests
ENTRYPOINT ["sh", "run.sh"]
