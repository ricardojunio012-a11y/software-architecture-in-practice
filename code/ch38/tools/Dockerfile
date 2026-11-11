FROM alpine:3.22
# diffutils: the BusyBox diff lacks some of the options the scripts use
RUN apk add --no-cache diffutils
ENTRYPOINT ["sh", "/ch38/tools/tools.sh"]
