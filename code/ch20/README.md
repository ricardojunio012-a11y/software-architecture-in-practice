# Chapter 20: architecture of AI systems

Lab for chapter 20 of *Software Architecture in Practice*.

The Board President's Assistant answers questions from the house rules and the meeting minutes of three communities, indexed in pgvector (RAG). The protected version searches only the asking community's documents, discards chunks with signs of prompt injection and chunks with low relevance, uses a cache per community, and respects a daily token budget per community. An evaluation suite compares the naive version with the protected one.

The language model sits behind the `Model` interface (`node/src/model.ts`). The lab uses a deterministic extractive model, so that it runs on any machine and always gives the same output; a real model plugs in by implementing the same interface.

| Version | What it does |
|---|---|
| `assistant` | Answers the questions in `input/conversation.json` and shows the origin of each answer (model, cache, or limit) and the spending per community |
| `evaluation` | Runs the suite in `input/evaluation.json` against the naive assistant and the protected one |
| `variation` | The hard part: runs the suite five times against a model that varies (a draw with a fixed seed) and checks by text and by content |

## Prerequisite

Docker with Docker Compose. This lab has only the TypeScript version. PostgreSQL with pgvector starts on its own.

## Walkthrough

```bash
docker compose run --rm app assistant
docker compose run --rm tools verify assistant
docker compose run --rm app evaluation
docker compose run --rm tools verify evaluation
docker compose run --rm app variation
docker compose run --rm tools verify variation
docker compose run --rm app tests
```

## Try it

- Remove the community from the cache key and watch one community's answer serve another.
- Write a new injection into a document and see whether the guard catches it.
- Add the question "Until what time can I make noise?" to the suite and explain the result.
- In the `variation` version, add seeds or change the slip chance in `node/src/variable-model.ts` and watch the success rate change.
