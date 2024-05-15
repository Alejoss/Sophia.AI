from langchain_chroma import Chroma
from langchain_community.document_loaders import DirectoryLoader
from langchain_community.embeddings.sentence_transformer import SentenceTransformerEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
import os
import shutil

CHROMA_PATH = "chroma_db"
DATA_PATH = "books"


def generate_data_store():
    print("Starting to generate data store...")
    documents = load_documents()
    if not documents:
        print("No documents loaded.")
        return

    chunks = split_text(documents)
    if not chunks:
        print("No chunks created from documents.")
        return

    save_to_chroma(chunks)
    print("Data store generation complete.")


def load_documents():
    print(f"Loading documents from {DATA_PATH}...")
    loader = DirectoryLoader(DATA_PATH, glob="*.md")
    documents = loader.load()
    print(f"Loaded {len(documents)} documents.")
    return documents


def split_text(documents):
    print("Splitting text into chunks...")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=0)
    chunks = text_splitter.split_documents(documents)
    print(f"Split {len(documents)} documents into {len(chunks)} chunks.")

    # Debugging: Print a sample chunk
    if chunks:
        document = chunks[0]
        print(f"Sample chunk content: {document.page_content}")
        print(f"Sample chunk metadata: {document.metadata}")
    else:
        print("No chunks were created.")

    return chunks


def save_to_chroma(chunks):
    print("Saving chunks to Chroma DB...")
    # Clear out the database first.
    if os.path.exists(CHROMA_PATH):
        shutil.rmtree(CHROMA_PATH)
        print(f"Existing Chroma DB at {CHROMA_PATH} removed.")

    # Create a new DB from the documents.
    embedding_function = SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")
    db = Chroma.from_documents(chunks, embedding_function, persist_directory=CHROMA_PATH)
    print(f"Saved {len(chunks)} chunks to {CHROMA_PATH}.")


if __name__ == "__main__":
    generate_data_store()
