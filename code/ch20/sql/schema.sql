-- The Assistant's knowledge base: each chunk of a community's documents, with its
-- vector. pgvector adds the vector type and the cosine distance operator (<=>).
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
CREATE EXTENSION vector;

CREATE TABLE chunks (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  community_id integer NOT NULL,
  document text NOT NULL,
  text text NOT NULL,
  embedding vector(256) NOT NULL
);
