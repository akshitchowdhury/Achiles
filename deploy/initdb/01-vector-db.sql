-- Runs once, when the postgres volume is first created.
--
-- The RAG service keeps its embeddings in their own database so the app
-- database stays free of langchain's tables. langchain-postgres creates the
-- vector extension itself on first connect; doing it here as well means that
-- works even if the service is later pointed at a non-superuser role.
CREATE DATABASE achiles_vectors;
\connect achiles_vectors
CREATE EXTENSION IF NOT EXISTS vector;
