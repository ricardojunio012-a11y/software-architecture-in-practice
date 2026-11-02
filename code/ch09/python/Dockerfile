FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir pytest==8.4.1 fastapi==0.115.12 httpx==0.28.1 anyio==4.9.0 "psycopg[binary]==3.2.3"
COPY run.sh ./
COPY morada ./morada
COPY tests ./tests
ENTRYPOINT ["sh", "run.sh"]
