
import os
import json
import asyncio
from dotenv import load_dotenv
import chromadb
from google import genai
from google.genai import types
from flask import Flask, request, jsonify
load_dotenv()

CLIENT = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


def _split_text(text: str, chunk_size: int = 500, chunk_overlap: int = 100):
    if chunk_overlap >= chunk_size:
        raise ValueError("chunk_overlap must be smaller than chunk_size.")
    
    chunks = []
    start_index = 0
    while start_index < len(text):
        end_index = start_index + chunk_size
        chunks.append(text[start_index:end_index])
        start_index += chunk_size - chunk_overlap
    return chunks


async def embed_database():
    print("--- Starting Database Embedding (No LangChain) ---")
    chroma_client = chromadb.PersistentClient(path="./medicines")
    collection = chroma_client.get_or_create_collection(name="meds")
    with open("./meds-info.json", "r", encoding="utf-8") as f:
        file_content = f.read()

    chunks = _split_text(file_content, chunk_size=500, chunk_overlap=100)
    print(f"Splitting into {len(chunks)} chunks.")

    result = CLIENT.models.embed_content(
        model="models/text-embedding-004",
        contents=chunks
    )

    embeddings_list = [embedding.values for embedding in result.embeddings]

    collection.add(
        embeddings=embeddings_list,
        documents=chunks,
        ids=[f"code_chunk_{i}" for i in range(len(chunks))]
    )
    print("--- Database Embedding Complete ---")

if __name__ == "__main__":
    asyncio.run(embed_database())