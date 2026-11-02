FROM alpine:3.22
# diffutils: BusyBox diff lacks some of the options the scripts use
RUN apk add --no-cache diffutils python3
ENTRYPOINT ["sh", "/ch03/tools/tools.sh"]
