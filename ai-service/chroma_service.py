"""
ChromaDB service wrapper for PlacementOS AI Service.
Manages two collections:
  - interview_vault: embedded interview questions per company
  - resumes: embedded resume text chunks per student
"""

import os
import chromadb
from chromadb.utils import embedding_functions
from typing import List, Optional

CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8001"))

# Use sentence-transformers all-MiniLM-L6-v2 (384 dims, runs on CPU)
_embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)


def _get_client() -> chromadb.HttpClient:
    return chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)


def get_vault_collection():
    client = _get_client()
    return client.get_or_create_collection(
        name="interview_vault",
        embedding_function=_embed_fn,
        metadata={"hnsw:space": "cosine"},
    )


def get_resume_collection():
    client = _get_client()
    return client.get_or_create_collection(
        name="resumes",
        embedding_function=_embed_fn,
        metadata={"hnsw:space": "cosine"},
    )


def ingest_vault_questions(questions: List[dict]) -> int:
    """
    Ingest interview questions into ChromaDB.
    Each question dict must have: id, question, topic, company_id, tenant_id
    Returns number of documents ingested.
    """
    collection = get_vault_collection()
    documents = [q["question"] for q in questions]
    ids = [q["id"] for q in questions]
    metadatas = [
        {
            "topic": q.get("topic", ""),
            "company_id": q.get("company_id", ""),
            "tenant_id": q.get("tenant_id", ""),
            "difficulty": q.get("difficulty", "medium"),
        }
        for q in questions
    ]
    collection.upsert(documents=documents, ids=ids, metadatas=metadatas)
    return len(documents)


def query_vault(
    query: str,
    tenant_id: str,
    company_id: Optional[str] = None,
    top_k: int = 5,
) -> List[dict]:
    """
    Semantic search over the interview vault.
    Returns top_k most similar questions with metadata.
    """
    collection = get_vault_collection()
    where_filter: dict = {"tenant_id": tenant_id}
    if company_id:
        where_filter = {"$and": [{"tenant_id": tenant_id}, {"company_id": company_id}]}

    try:
        results = collection.query(
            query_texts=[query],
            n_results=top_k,
            where=where_filter,
        )
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        return [
            {
                "question": doc,
                "topic": meta.get("topic", ""),
                "company_id": meta.get("company_id", ""),
                "difficulty": meta.get("difficulty", ""),
                "similarity": round(1 - dist, 4),
            }
            for doc, meta, dist in zip(documents, metadatas, distances)
        ]
    except Exception:
        # ChromaDB collection may be empty in test environments
        return []


def ingest_resume_chunk(student_id: str, tenant_id: str, resume_text: str) -> None:
    """Embed and store a resume text chunk for future similarity search."""
    collection = get_resume_collection()
    collection.upsert(
        documents=[resume_text],
        ids=[f"resume:{student_id}"],
        metadatas=[{"student_id": student_id, "tenant_id": tenant_id}],
    )
