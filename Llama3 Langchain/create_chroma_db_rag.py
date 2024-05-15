from typing import List
from langchain_community.document_loaders import DirectoryLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from langchain_community.embeddings import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
import os
import shutil

CHROMA_PATH = "chroma_db"
DATA_PATH = "books"
open_ai_api_key = ""


def generate_data_store():
    print("Starting to generate data store...")
    documents = load_documents()
    chunks = split_text(documents)
    save_to_chroma(chunks)
    print("Data store generation complete.")


# https://github.com/mlschmitt/classic-books-markdown/tree/main
def load_documents():
    print(f"Loading documents from {DATA_PATH}...")
    loader = DirectoryLoader(DATA_PATH, glob="*.md")
    documents = loader.load()
    print(f"Loaded {len(documents)} documents.")
    return documents


def split_text(documents: List[Document]):
    print("Splitting text into chunks...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=100,
        length_function=len,
        add_start_index=True
    )
    chunks = text_splitter.split_documents(documents)
    print(f"Split {len(documents)} documents into {len(chunks)} chunks.")

    # Debugging: Print a sample chunk
    if chunks:
        document = chunks[10]
        print(f"Sample chunk content: {document.page_content}")
        print(f"Sample chunk metadata: {document.metadata}")
    else:
        print("No chunks were created.")

    return chunks


def save_to_chroma(chunks: List[Document]):
    print("Saving chunks to Chroma DB...")
    # Clear out the database first.
    if os.path.exists(CHROMA_PATH):
        shutil.rmtree(CHROMA_PATH)
        print(f"Existing Chroma DB at {CHROMA_PATH} removed.")

    # Create a new DB from the documents.
    db = Chroma.from_documents(
        chunks, OpenAIEmbeddings(api_key=open_ai_api_key), persist_directory=CHROMA_PATH
    )
    db.persist()
    print(f"Saved {len(chunks)} chunks to {CHROMA_PATH}.")


if __name__ == "__main__":
    generate_data_store()
