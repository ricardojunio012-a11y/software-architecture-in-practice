FROM alpine:3.22
# diffutils: BusyBox diff lacks some of the options the scripts use
RUN apk add --no-cache diffutils
ENTRYPOINT ["sh", "/ch07/tools/tools.sh"]
